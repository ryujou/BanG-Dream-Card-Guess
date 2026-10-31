package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

func main() {
	root, err := os.Getwd()
	if err != nil {
		log.Fatal(err)
	}
	if filepath.Base(root) == "backend" {
		root = filepath.Dir(root)
	}
	if _, err = os.Stat(filepath.Join(root, ".env")); err == nil {
		if err = godotenv.Load(filepath.Join(root, ".env")); err != nil {
			log.Fatal(err)
		}
	}
	app, err := NewApp(AppOptions{RootDir: root})
	if err != nil {
		log.Fatal(err)
	}
	host, port := os.Getenv("HOST"), os.Getenv("PORT")
	if host == "" {
		host = "127.0.0.1"
	}
	if port == "" {
		port = "8080"
	}
	server := &http.Server{Addr: host + ":" + port, Handler: app.Handler(), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 90 * time.Second, MaxHeaderBytes: 32 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		app.StopRealtime()
		if err := server.Shutdown(shutdown); err != nil {
			log.Print(err)
		}
		app.Close()
	}()
	log.Printf("xtbang Go API listening on %s", server.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
	<-shutdownDone
}
