package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"strconv"
)

type Obj = map[string]any

type HTTPError struct {
	Status  int
	Message string
}

func (e *HTTPError) Error() string               { return e.Message }
func httpError(status int, message string) error { return &HTTPError{status, message} }
func asString(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprint(v)
}
func number(v any) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case float32:
		return float64(n)
	case int:
		return float64(n)
	case int64:
		return float64(n)
	case json.Number:
		f, _ := n.Float64()
		return f
	case string:
		f, _ := strconv.ParseFloat(n, 64)
		return f
	}
	return 0
}
func integer(v any) int  { return int(number(v)) }
func asObject(v any) Obj { o, _ := v.(map[string]any); return o }
func randomID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 15) | 64
	b[8] = (b[8] & 63) | 128
	s := hex.EncodeToString(b)
	return s[:8] + "-" + s[8:12] + "-" + s[12:16] + "-" + s[16:20] + "-" + s[20:]
}
func readBody(w http.ResponseWriter, r *http.Request, maxBytes int64) (Obj, error) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	decoder := json.NewDecoder(r.Body)
	var body Obj
	if err := decoder.Decode(&body); err != nil {
		var oversized *http.MaxBytesError
		if errors.As(err, &oversized) {
			return nil, httpError(413, "请求内容过大")
		}
		return nil, httpError(400, "请求格式无效")
	}
	if body == nil {
		return nil, httpError(400, "请求格式无效")
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return nil, httpError(400, "请求格式无效")
	}
	return body, nil
}
func writeJSON(w http.ResponseWriter, status int, value any) {
	body, err := json.Marshal(value)
	if err != nil {
		log.Printf("encode JSON response: %v", err)
		status = http.StatusInternalServerError
		body = []byte(`{"error":"服务暂时无法完成请求"}`)
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if _, err := w.Write(append(body, '\n')); err != nil {
		log.Printf("write JSON response: %v", err)
	}
}
func writeError(w http.ResponseWriter, err error) {
	status, message := 500, "服务暂时无法完成请求"
	var failure *HTTPError
	if errors.As(err, &failure) {
		status, message = failure.Status, failure.Message
	}
	if status >= 500 {
		log.Printf("request failed: %v", err)
	}
	writeJSON(w, status, Obj{"error": message})
}
func finite(v any) bool {
	if v == nil {
		return false
	}
	n, err := strconv.ParseFloat(asString(v), 64)
	return err == nil && !math.IsNaN(n) && !math.IsInf(n, 0)
}
