package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func loginBusinessClient(t *testing.T, c *scoreHTTPClient, username, password string) {
	t.Helper()
	status, body := c.request(t, "POST", "/api/auth/login", Obj{"username": username, "password": password})
	if status != 200 {
		t.Fatalf("login: %d %v", status, body)
	}
	c.csrf = asString(body["csrfToken"])
}
func TestHTTPAdministrationRoomsAndRevocation(t *testing.T) {
	_, server := scoreFixture(t)
	admin := scoreClient(t, server.URL)
	loginBusinessClient(t, admin, "admin", "score-test-password")
	status, created := admin.request(t, "POST", "/api/admin/users", Obj{"username": "stage_host", "displayName": "测试主持", "role": "host", "password": "host-password-2026"})
	if status != 201 {
		t.Fatalf("create host: %d %v", status, created)
	}
	id := asString(asObject(created["user"])["id"])
	host := scoreClient(t, server.URL)
	loginBusinessClient(t, host, "stage_host", "host-password-2026")
	status, room := host.request(t, "POST", "/api/rooms", Obj{"name": "世界计划房间", "theme": "sekai"})
	if status != 201 {
		t.Fatalf("create room: %d %v", status, room)
	}
	code := asString(asObject(room["room"])["code"])
	status, detail := host.request(t, "GET", "/api/rooms/"+code, nil)
	if status != 200 || asObject(detail["room"])["theme"] != "sekai" {
		t.Fatalf("room metadata: %d %v", status, detail)
	}
	status, detail = host.request(t, "PATCH", "/api/rooms/"+code, Obj{"name": "重命名的房间"})
	if status != 200 || asObject(detail["room"])["name"] != "重命名的房间" {
		t.Fatal("rename failed", status, detail)
	}
	status, detail = host.request(t, "PATCH", "/api/rooms/"+code+"/settings", Obj{"revealAfterJudge": false, "roundSeconds": 42})
	if status != 200 || asObject(detail["settings"])["revealAfterJudge"] != false {
		t.Fatal("settings failed", status, detail)
	}
	for i := 0; i < 4; i++ {
		status, _ = host.request(t, "POST", "/api/rooms", Obj{})
		if status != 201 {
			t.Fatal("room allocation", status)
		}
	}
	status, _ = host.request(t, "POST", "/api/rooms", Obj{})
	if status != 409 {
		t.Fatal("per host quota", status)
	}
	status, listing := host.request(t, "GET", "/api/rooms", nil)
	if status != 200 || len(listing["rooms"].([]any)) != 5 {
		t.Fatal("room list", status, listing)
	}
	status, _ = admin.request(t, "POST", "/api/admin/users/"+id+"/reset-password", Obj{"password": "host-reset-password"})
	if status != 200 {
		t.Fatal("reset", status)
	}
	status, _ = host.request(t, "GET", "/api/rooms", nil)
	if status != 401 {
		t.Fatal("reset must revoke", status)
	}
	host = scoreClient(t, server.URL)
	loginBusinessClient(t, host, "stage_host", "host-reset-password")
	status, _ = admin.request(t, "PATCH", "/api/admin/users/"+id, Obj{"enabled": false})
	if status != 200 {
		t.Fatal("disable", status)
	}
	status, _ = host.request(t, "GET", "/api/rooms", nil)
	if status != 401 {
		t.Fatal("disabled session", status)
	}
	status, listing = admin.request(t, "GET", "/api/rooms", nil)
	if status != 200 || len(listing["rooms"].([]any)) != 0 {
		t.Fatal("disabled host rooms remain", listing)
	}
	status, _ = admin.request(t, "DELETE", "/api/admin/users/"+id, nil)
	if status != 200 {
		t.Fatal("delete", status)
	}
	status, _ = admin.request(t, "POST", "/api/auth/change-password", Obj{"currentPassword": "score-test-password", "newPassword": "changed-admin-password"})
	if status != 200 {
		t.Fatal("own password", status)
	}
	status, _ = admin.request(t, "GET", "/api/admin/users", nil)
	if status != 401 {
		t.Fatal("own password must revoke", status)
	}
}
func TestHTTPSettingsCommunityUploadsAndQR(t *testing.T) {
	_, server := scoreFixture(t)
	admin := scoreClient(t, server.URL)
	loginBusinessClient(t, admin, "admin", "score-test-password")
	status, body := admin.request(t, "PUT", "/api/settings", Obj{"stopwatchTargetSeconds": 12, "stopwatchToleranceSeconds": 0.2})
	if status != 200 {
		t.Fatal(status, body)
	}
	status, body = admin.request(t, "GET", "/api/stopwatch-settings", nil)
	if status != 200 || number(body["targetSeconds"]) != 12 {
		t.Fatal(status, body)
	}
	community := Obj{"aboutUs": "社团测试", "socialLinks": []Obj{}, "members": []Obj{}, "events": []Obj{}, "photos": []Obj{}}
	status, _ = admin.request(t, "PUT", "/api/community", community)
	if status != 200 {
		t.Fatal(status)
	}
	status, body = admin.request(t, "GET", "/api/community", nil)
	if status != 200 || body["aboutUs"] != "社团测试" {
		t.Fatal(body)
	}
	status, _ = admin.request(t, "PUT", "/api/community", Obj{"aboutUs": "x"})
	if status != 400 {
		t.Fatal("invalid community", status)
	}
	img := image.NewNRGBA(image.Rect(0, 0, 3, 2))
	img.Set(1, 1, color.NRGBA{R: 255, A: 255})
	var source bytes.Buffer
	if err := png.Encode(&source, img); err != nil {
		t.Fatal(err)
	}
	status, body = admin.request(t, "POST", "/api/uploads", Obj{"image": "data:image/png;base64," + base64.StdEncoding.EncodeToString(source.Bytes())})
	if status != 200 {
		t.Fatal(status, body)
	}
	response, err := admin.client.Get(server.URL + asString(body["url"]))
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := png.Decode(response.Body)
	response.Body.Close()
	if err != nil || decoded.Bounds() != img.Bounds() {
		t.Fatal("uploaded PNG", err)
	}
	var jpegSource bytes.Buffer
	if err = jpeg.Encode(&jpegSource, img, nil); err != nil {
		t.Fatal(err)
	}
	webpSource, err := os.ReadFile(filepath.Join("testdata", "upload.webp"))
	if err != nil {
		t.Fatal(err)
	}
	// A TIFF orientation value of 6 is the 90-degree rotation used by phone JPEGs.
	exif := []byte{0xff, 0xe1, 0, 34, 'E', 'x', 'i', 'f', 0, 0, 'I', 'I', 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0}
	oriented := append([]byte{}, jpegSource.Bytes()[:2]...)
	oriented = append(oriented, exif...)
	oriented = append(oriented, jpegSource.Bytes()[2:]...)
	for _, sample := range []struct {
		mime          string
		data          []byte
		width, height int
	}{{"image/jpeg", jpegSource.Bytes(), 3, 2}, {"image/jpeg", oriented, 2, 3}, {"image/webp", webpSource, 0, 0}} {
		status, body = admin.request(t, "POST", "/api/uploads", Obj{"image": "data:" + sample.mime + ";base64," + base64.StdEncoding.EncodeToString(sample.data)})
		if status != 200 {
			t.Fatal("upload format", sample.mime, status, body)
		}
		response, err = admin.client.Get(server.URL + asString(body["url"]))
		if err != nil {
			t.Fatal(err)
		}
		out, decodeErr := png.Decode(response.Body)
		response.Body.Close()
		if decodeErr != nil {
			t.Fatal(decodeErr)
		}
		if sample.width > 0 && (out.Bounds().Dx() != sample.width || out.Bounds().Dy() != sample.height) {
			t.Fatal("EXIF orientation", out.Bounds())
		}
	}
	for _, data := range []string{"data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,bm90LWFuLWltYWdl", "data:image/png;base64,%%%"} {
		status, _ = admin.request(t, "POST", "/api/uploads", Obj{"image": data})
		if status != 400 {
			t.Fatal("invalid upload", status)
		}
	}
	response, err = admin.client.Get(server.URL + "/api/qr?text=https%3A%2F%2Fxtbang.top%2F%3Fq%3D%E4%B8%AD%E6%96%87")
	if err != nil {
		t.Fatal(err)
	}
	svg, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || response.StatusCode != 200 || !strings.Contains(string(svg), "<svg") {
		t.Fatal("QR", err, response.StatusCode)
	}
	status, body = admin.request(t, "GET", "/api/network", nil)
	if status != 200 || asObject(body["urls"])["solo"] != "http://score.test/solo" {
		t.Fatal("network", body)
	}
	status, body = admin.request(t, "GET", "/api/diagnostics", nil)
	if status != 200 || body["runtime"] != "go" || number(body["users"]) != 1 {
		t.Fatal("diagnostics", status, body)
	}
}

func TestHTTPRelativeDataDirectoryAndRestart(t *testing.T) {
	project, err := filepath.Abs("..")
	if err != nil {
		t.Fatal(err)
	}
	options := AppOptions{RootDir: t.TempDir(), DataDir: "relative-data", ResourceDir: filepath.Join(project, "resource"), PublicDir: filepath.Join(project, "public"), PublicOrigin: "http://score.test", BootstrapPassword: "score-test-password"}
	app, err := NewApp(options)
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(app.Handler())
	client := scoreClient(t, server.URL)
	loginBusinessClient(t, client, "admin", "score-test-password")
	status, _ := client.request(t, "POST", "/api/admin/users", Obj{"username": "persist_host", "password": "persist-password", "displayName": "持久账号", "role": "host"})
	if status != 201 {
		t.Fatal(status)
	}
	status, _ = client.request(t, "PUT", "/api/settings", Obj{"roundSeconds": 73})
	if status != 200 {
		t.Fatal(status)
	}
	status, _ = client.request(t, "PUT", "/api/community", Obj{"aboutUs": "持久社区", "socialLinks": []any{}, "members": []any{}, "events": []any{}, "photos": []any{}})
	if status != 200 {
		t.Fatal(status)
	}
	if _, err = app.store.AddScore("note", Obj{"player_id": "legacy-player", "final_score": 100}); err != nil {
		t.Fatal(err)
	}
	status, _ = client.request(t, "POST", "/api/rooms", Obj{})
	if status != 201 {
		t.Fatal(status)
	}
	status, _ = client.request(t, "POST", "/api/solo", Obj{})
	if status != 200 {
		t.Fatal(status)
	}
	server.Close()
	app.Close()
	if _, err = os.Stat(filepath.Join(options.RootDir, "relative-data", "app.sqlite")); err != nil {
		t.Fatal(err)
	}
	app, err = NewApp(options)
	if err != nil {
		t.Fatal(err)
	}
	defer app.Close()
	users, err := app.store.Users()
	if err != nil || len(users) != 2 {
		t.Fatal("users", users, err)
	}
	settings, err := app.settings()
	if err != nil || number(settings["roundSeconds"]) != 73 {
		t.Fatal("settings", settings, err)
	}
	community, err := app.store.GetValue("community", nil)
	if err != nil || asObject(community)["aboutUs"] != "持久社区" {
		t.Fatal("community", err)
	}
	rows, err := app.store.ScoreRows("note")
	if err != nil || len(rows) != 1 {
		t.Fatal("scores", err)
	}
	if app.sessions.Count() != 0 || len(app.rooms) != 0 || len(app.solos) != 0 {
		t.Fatal("ephemeral state survived restart")
	}
}
func TestHTTPStatisticsUpstreamContract(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/share/share-id" {
			writeJSON(w, 200, Obj{"websiteId": "website-id", "token": "test-share-token"})
			return
		}
		if r.Header.Get("x-umami-share-token") != "test-share-token" {
			t.Error("missing upstream share authorization")
		}
		if strings.HasSuffix(r.URL.Path, "/stats") {
			writeJSON(w, 200, Obj{"pageviews": Obj{"value": 20}, "visitors": Obj{"value": 5}})
		} else {
			writeJSON(w, 200, []Obj{{"x": "CN", "y": 3}})
		}
	}))
	defer upstream.Close()
	t.Setenv("UMAMI_BASE_URL", upstream.URL)
	t.Setenv("UMAMI_WEBSITE_ID", "website-id")
	t.Setenv("UMAMI_SHARE_ID", "share-id")
	t.Setenv("UMAMI_API_TOKEN", "")
	_, server := scoreFixture(t)
	client := scoreClient(t, server.URL)
	status, body := client.request(t, "GET", "/api/stats", nil)
	if status != 200 || body["configured"] != true || number(body["pageviews"]) != 20 || number(body["visitors"]) != 5 {
		t.Fatal(status, body)
	}
	encoded, _ := json.Marshal(body)
	if bytes.Contains(encoded, []byte("token")) {
		t.Fatal("upstream credentials disclosed")
	}
	t.Setenv("UMAMI_SHARE_ID", "")
	status, body = client.request(t, "GET", "/api/stats", nil)
	if status != 200 || body["configured"] != false {
		t.Fatal("unconfigured stats", status, body)
	}
}
