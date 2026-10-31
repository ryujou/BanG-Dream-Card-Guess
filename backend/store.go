package main

import (
	"crypto/rand"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf16"

	"golang.org/x/crypto/scrypt"
	_ "modernc.org/sqlite"
)

type User struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
	Enabled     bool   `json:"enabled"`
	CreatedAt   int64  `json:"createdAt"`
	UpdatedAt   int64  `json:"updatedAt"`
}

type Store struct {
	db        *sql.DB
	dummyHash string
}

const userColumns = "id,username,displayName,role,enabled,createdAt,updatedAt"

// Each Node-compatible scrypt operation needs about 16 MiB on the 757 MiB host.
var passwordWork = make(chan struct{}, 2)

func NewStore(filename, bootstrap string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(filename), 0700); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", filename)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	s := &Store{db: db}
	_, err = db.Exec(`PRAGMA journal_mode=WAL;
		CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,username TEXT NOT NULL COLLATE NOCASE UNIQUE,displayName TEXT NOT NULL,role TEXT NOT NULL,enabled INTEGER NOT NULL,passwordHash TEXT NOT NULL,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
		CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
		CREATE TABLE IF NOT EXISTS scores (id TEXT PRIMARY KEY,kind TEXT NOT NULL,at INTEGER NOT NULL,payload TEXT NOT NULL);`)
	if err == nil {
		err = os.Chmod(filename, 0600)
	}
	if err == nil {
		s.dummyHash, err = hashPassword(randomID())
	}
	if err == nil {
		var count int
		err = db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
		if err == nil && count == 0 {
			if bootstrap == "" {
				err = errors.New("首次启动需要 BOOTSTRAP_ADMIN_PASSWORD（10—128 位）")
			} else {
				_, err = s.CreateUser(Obj{"username": "admin", "displayName": "管理员", "role": "super_admin", "password": bootstrap})
			}
		}
	}
	if err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

func scanUser(row interface{ Scan(...any) error }) (*User, error) {
	var u User
	var enabled int
	err := row.Scan(&u.ID, &u.Username, &u.DisplayName, &u.Role, &enabled, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	u.Enabled = enabled != 0
	return &u, nil
}

func (s *Store) Users() ([]User, error) {
	rows, err := s.db.Query("SELECT " + userColumns + " FROM users ORDER BY createdAt")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, *u)
	}
	return users, rows.Err()
}

func (s *Store) User(id string) (*User, error) {
	return scanUser(s.db.QueryRow("SELECT "+userColumns+" FROM users WHERE id=?", id))
}

func NormalizeUsername(value string) string { return strings.ToLower(strings.TrimSpace(value)) }

func (s *Store) Authenticate(username, password string) (*User, error) {
	var u User
	var enabled int
	var encoded string
	err := s.db.QueryRow("SELECT "+userColumns+",passwordHash FROM users WHERE username=? COLLATE NOCASE", NormalizeUsername(username)).Scan(
		&u.ID, &u.Username, &u.DisplayName, &u.Role, &enabled, &u.CreatedAt, &u.UpdatedAt, &encoded,
	)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	// Missing and disabled accounts pay the same password-verification cost.
	if err != nil || enabled == 0 {
		encoded = s.dummyHash
	}
	valid, err := verifyPassword(password, encoded)
	if err != nil {
		return nil, err
	}
	if !valid || enabled == 0 || u.ID == "" {
		return nil, nil
	}
	u.Enabled = true
	return &u, nil
}

func validUsername(username string) bool {
	if len(username) < 3 || len(username) > 32 {
		return false
	}
	for _, ch := range username {
		if !(ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch >= '0' && ch <= '9' || ch == '_' || ch == '-') {
			return false
		}
	}
	return true
}

func (s *Store) CreateUser(input Obj) (*User, error) {
	username := strings.TrimSpace(asString(input["username"]))
	if !validUsername(username) {
		return nil, httpError(400, "用户名需为3—32位字母、数字、下划线或连字符")
	}
	hash, err := hashPassword(asString(input["password"]))
	if err != nil {
		return nil, err
	}
	role := "host"
	if input["role"] == "super_admin" {
		role = "super_admin"
	}
	displayName := strings.TrimSpace(asString(input["displayName"]))
	if displayName == "" {
		displayName = username
	}
	u := &User{ID: randomID(), Username: username, DisplayName: truncateText(displayName, 40), Role: role, Enabled: input["enabled"] != false, CreatedAt: time.Now().UnixMilli()}
	u.UpdatedAt = u.CreatedAt
	_, err = s.db.Exec("INSERT INTO users(id,username,displayName,role,enabled,passwordHash,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)", u.ID, u.Username, u.DisplayName, u.Role, u.Enabled, hash, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: users.username") {
			return nil, httpError(409, "用户名已存在")
		}
		return nil, err
	}
	return u, nil
}

func checkOtherAdmin(tx *sql.Tx, id string) error {
	var count int
	if err := tx.QueryRow("SELECT COUNT(*) FROM users WHERE id<>? AND role='super_admin' AND enabled=1", id).Scan(&count); err != nil {
		return err
	}
	if count == 0 {
		return httpError(409, "必须保留一位有效的超级管理员")
	}
	return nil
}

func (s *Store) UpdateUser(id string, input Obj, actorID string) (*User, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	u, err := scanUser(tx.QueryRow("SELECT "+userColumns+" FROM users WHERE id=?", id))
	if err != nil {
		return nil, err
	}
	if u == nil {
		return nil, httpError(404, "账号不存在")
	}
	previousRole, previousEnabled := u.Role, u.Enabled
	if value, exists := input["role"]; exists {
		u.Role = asString(value)
	}
	if u.Role != "host" && u.Role != "super_admin" {
		return nil, httpError(400, "角色无效")
	}
	if value, ok := input["enabled"].(bool); ok {
		u.Enabled = value
	}
	if id == actorID && !u.Enabled {
		return nil, httpError(409, "不能停用当前账号")
	}
	if previousRole == "super_admin" && previousEnabled && (!u.Enabled || u.Role != "super_admin") {
		if err := checkOtherAdmin(tx, id); err != nil {
			return nil, err
		}
	}
	if value, exists := input["displayName"]; exists {
		u.DisplayName = truncateText(strings.TrimSpace(asString(value)), 40)
		if u.DisplayName == "" {
			u.DisplayName = u.Username
		}
	}
	now := time.Now().UnixMilli()
	if now <= u.UpdatedAt {
		now = u.UpdatedAt + 1
	}
	u.UpdatedAt = now
	if _, err := tx.Exec("UPDATE users SET role=?,enabled=?,displayName=?,updatedAt=? WHERE id=?", u.Role, u.Enabled, u.DisplayName, u.UpdatedAt, id); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Store) DeleteUser(id, actorID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	u, err := scanUser(tx.QueryRow("SELECT "+userColumns+" FROM users WHERE id=?", id))
	if err != nil {
		return err
	}
	if u == nil {
		return httpError(404, "账号不存在")
	}
	if id == actorID {
		return httpError(409, "不能删除当前账号")
	}
	if u.Role == "super_admin" && u.Enabled {
		if err := checkOtherAdmin(tx, id); err != nil {
			return err
		}
	}
	if _, err := tx.Exec("DELETE FROM users WHERE id=?", id); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) ResetPassword(id, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	result, err := s.db.Exec("UPDATE users SET passwordHash=?,updatedAt=MAX(?,updatedAt+1) WHERE id=?", hash, time.Now().UnixMilli(), id)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return httpError(404, "账号不存在")
	}
	return nil
}

func (s *Store) GetValue(key string, fallback any) (any, error) {
	var raw string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key=?", key).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		encoded, marshalErr := json.Marshal(fallback)
		if marshalErr != nil {
			return nil, marshalErr
		}
		raw = string(encoded)
	} else if err != nil {
		return nil, err
	}
	var value any
	if err := json.Unmarshal([]byte(raw), &value); err != nil {
		return nil, err
	}
	return value, nil
}

func (s *Store) SetValue(key string, value any) error {
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = s.db.Exec("INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, string(encoded))
	return err
}

func (s *Store) ScoreRows(kind string) ([]Obj, error) {
	rows, err := s.db.Query("SELECT payload FROM scores WHERE kind=? ORDER BY at DESC", kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Obj{}
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var item Obj
		if err := json.Unmarshal([]byte(raw), &item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) AddScore(kind string, payload Obj) (Obj, error) {
	row := make(Obj, len(payload)+2)
	for key, value := range payload {
		row[key] = value
	}
	id, at := randomID(), time.Now().UnixMilli()
	row["id"], row["at"] = id, at
	encoded, err := json.Marshal(row)
	if err != nil {
		return nil, err
	}
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	if _, err := tx.Exec("INSERT INTO scores VALUES (?,?,?,?)", id, kind, at, string(encoded)); err != nil {
		return nil, err
	}
	limit := 1000
	if kind == "note" {
		limit = 2000
	}
	if _, err := tx.Exec("DELETE FROM scores WHERE kind=? AND id NOT IN (SELECT id FROM scores WHERE kind=? ORDER BY at DESC LIMIT ?)", kind, kind, limit); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return row, nil
}

func (s *Store) DeleteScore(id string) error {
	_, err := s.db.Exec("DELETE FROM scores WHERE id=?", id)
	return err
}

func (s *Store) ClearScores(kind string) error {
	_, err := s.db.Exec("DELETE FROM scores WHERE kind=?", kind)
	return err
}

func truncateText(value string, limit int) string {
	text := []rune(value)
	if len(text) > limit {
		return string(text[:limit])
	}
	return value
}

func hashPassword(password string) (string, error) {
	length := passwordLength(password)
	if length < 10 || length > 128 {
		return "", httpError(400, "密码需为10—128位")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	derived, err := derivePassword(password, salt)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(salt) + "$" + base64.StdEncoding.EncodeToString(derived), nil
}

func verifyPassword(password, encoded string) (bool, error) {
	saltText, expectedText, found := strings.Cut(encoded, "$")
	if !found {
		return false, errors.New("密码存储格式无效")
	}
	salt, err := base64.StdEncoding.DecodeString(saltText)
	if err != nil {
		return false, fmt.Errorf("密码盐格式无效: %w", err)
	}
	expected, err := base64.StdEncoding.DecodeString(expectedText)
	if err != nil {
		return false, fmt.Errorf("密码校验值格式无效: %w", err)
	}
	if len(salt) != 16 || len(expected) != 64 {
		return false, errors.New("密码存储长度无效")
	}
	actual, err := derivePassword(password, salt)
	if err != nil {
		return false, err
	}
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

func passwordLength(password string) int { return len(utf16.Encode([]rune(password))) }

func derivePassword(password string, salt []byte) ([]byte, error) {
	select {
	case passwordWork <- struct{}{}:
		defer func() { <-passwordWork }()
	default:
		return nil, httpError(429, "密码校验繁忙，请稍后再试")
	}
	return scrypt.Key([]byte(password), salt, 16384, 8, 1, 64)
}
