package main

import (
	"embed"
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"robonew/backend"
	"time"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend
var rawAssets embed.FS

func main() {
	mcpFlag := flag.Bool("mcp", false, "Run as Model Context Protocol (MCP) server over stdio")
	renderFlag := flag.String("render", "", "Headless render project path")
	outputFlag := flag.String("output", "", "Output video file name")
	flag.Parse()

	exePath, err := os.Executable()
	baseDir := "."
	if err == nil {
		baseDir = filepath.Dir(exePath)
	}
	templateDir := filepath.Join(baseDir, "template")
	if _, err := os.Stat(templateDir); err != nil {
		templateDir = "template"
	}

	app := backend.NewApp(templateDir)

	// Mode 1: MCP Server for AI Agents
	if *mcpFlag {
		if err := app.MCPServer.Run(os.Stdin, os.Stdout); err != nil {
			fmt.Fprintf(os.Stderr, "MCP Server error: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// Mode 2: Headless CLI Render
	if *renderFlag != "" {
		fmt.Printf("Starting headless render for %s...\n", *renderFlag)
		err := app.RenderManager.StartRender(*renderFlag, *outputFlag, func(step string, pct float64) {
			fmt.Printf("  [%3.0f%%] %s\n", pct*100, step)
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Render failed: %v\n", err)
			os.Exit(1)
		}
		for {
			st := app.RenderManager.GetStatus()
			if !st.Running {
				if st.Error != "" {
					fmt.Fprintf(os.Stderr, "Render error: %s\n", st.Error)
					os.Exit(1)
				}
				fmt.Printf("Render completed successfully! Output: %s\n", st.OutputFile)
				break
			}
			time.Sleep(500 * time.Millisecond)
		}
		return
	}

	assets, err := fs.Sub(rawAssets, "frontend")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to sub frontend fs: %v\n", err)
		os.Exit(1)
	}

	// Mode 3: Wails Desktop GUI Application
	err = wails.Run(&options.App{
		Title:  "Robonew Studio",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 20, G: 20, B: 24, A: 1},
		OnStartup:        app.Startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
