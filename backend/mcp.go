package backend

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type MCPResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   interface{} `json:"error,omitempty"`
}

type MCPTool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema interface{} `json:"inputSchema"`
}

type MCPServer struct {
	configManager *ConfigManager
	renderManager *RenderManager
	templatesDir  string
}

func NewMCPServer(cm *ConfigManager, rm *RenderManager, templatesDir string) *MCPServer {
	return &MCPServer{
		configManager: cm,
		renderManager: rm,
		templatesDir:  templatesDir,
	}
}

func (s *MCPServer) Run(r io.Reader, w io.Writer) error {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var req MCPRequest
		if err := json.Unmarshal(line, &req); err != nil {
			continue
		}

		resp := s.handleRequest(&req)
		out, err := json.Marshal(resp)
		if err == nil {
			_, _ = w.Write(append(out, '\n'))
		}
	}
	return scanner.Err()
}

func (s *MCPServer) handleRequest(req *MCPRequest) *MCPResponse {
	switch req.Method {
	case "initialize":
		return &MCPResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"protocolVersion": "2024-11-05",
				"capabilities": map[string]interface{}{
					"tools": map[string]interface{}{},
				},
				"serverInfo": map[string]interface{}{
					"name":    "robonew-mcp",
					"version": "1.0.0",
				},
			},
		}

	case "tools/list":
		tools := []MCPTool{
			{
				Name:        "robonew_list_projects",
				Description: "List all slide and video projects in the workspace",
				InputSchema: map[string]interface{}{
					"type": "object",
				},
			},
			{
				Name:        "robonew_read_project",
				Description: "Read project details including script lines, preview settings, and status",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{
							"type":        "string",
							"description": "Project name or relative path",
						},
					},
					"required": []string{"name"},
				},
			},
			{
				Name:        "robonew_create_project",
				Description: "Create a new slide project from template or empty video project",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{
							"type":        "string",
							"description": "Project name",
						},
						"template": map[string]interface{}{
							"type":        "string",
							"description": "Template ID (default: beeknoee-slide-starter)",
						},
						"khung": map[string]interface{}{
							"type":        "string",
							"description": "'doc' (9:16) or 'ngang' (16:9)",
						},
					},
					"required": []string{"name"},
				},
			},
			{
				Name:        "robonew_update_script",
				Description: "Write script-90s.txt to a project",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{
							"type":        "string",
							"description": "Project name",
						},
						"script": map[string]interface{}{
							"type":        "string",
							"description": "Full script content",
						},
					},
					"required": []string{"name", "script"},
				},
			},
			{
				Name:        "robonew_render_video",
				Description: "Render project to MP4 video",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"name": map[string]interface{}{
							"type":        "string",
							"description": "Project name",
						},
						"outputName": map[string]interface{}{
							"type":        "string",
							"description": "Optional output file name",
						},
					},
					"required": []string{"name"},
				},
			},
			{
				Name:        "robonew_test_ai",
				Description: "Test Custom LLM OpenAI-compatible endpoint",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"baseUrl": map[string]interface{}{"type": "string", "description": "Custom API base URL"},
						"apiKey":  map[string]interface{}{"type": "string", "description": "API Key"},
						"model":   map[string]interface{}{"type": "string", "description": "Model name"},
					},
					"required": []string{"baseUrl", "model"},
				},
			},
			{
				Name:        "robonew_generate_deck",
				Description: "Generate a complete 6-slide video deck using the configured LLM and TTS",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"topic": map[string]interface{}{"type": "string", "description": "The video topic/idea"},
					},
					"required": []string{"topic"},
				},
			},
			{
				Name:        "robonew_tts_synthesize",
				Description: "Synthesize speech using Edge, ElevenLabs, or Vbee",
				InputSchema: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"text":   map[string]interface{}{"type": "string"},
						"engine": map[string]interface{}{"type": "string", "description": "edge | eleven | vbee"},
						"voice":  map[string]interface{}{"type": "string"},
					},
					"required": []string{"text", "engine"},
				},
			},
		}
		return &MCPResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"tools": tools,
			},
		}

	case "tools/call":
		var callParams struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		_ = json.Unmarshal(req.Params, &callParams)

		root := s.configManager.Settings.SourceRoot

		switch callParams.Name {
		case "robonew_list_projects":
			projects, err := ListProjects(root)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": fmt.Sprintf("%v", projects)}}}}

		case "robonew_read_project":
			name, _ := callParams.Arguments["name"].(string)
			dir := filepath.Join(root, name)
			detail, err := ReadProject(dir)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			data, _ := json.MarshalIndent(detail, "", "  ")
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": string(data)}}}}

		case "robonew_create_project":
			name, _ := callParams.Arguments["name"].(string)
			tpl, _ := callParams.Arguments["template"].(string)
			khung, _ := callParams.Arguments["khung"].(string)

			var dir string
			var err error
			if tpl == "video" {
				dir, err = CreateVideoProject(root, name, khung)
			} else {
				dir, err = CreateFromTemplate(root, tpl, name, s.templatesDir)
			}
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": "Created project at " + dir}}}}

		case "robonew_update_script":
			name, _ := callParams.Arguments["name"].(string)
			script, _ := callParams.Arguments["script"].(string)
			dir := filepath.Join(root, name)
			scriptPath := filepath.Join(dir, "script-90s.txt")
			if err := os.WriteFile(scriptPath, []byte(strings.TrimSpace(script)+"\n"), 0644); err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": "Updated script-90s.txt successfully."}}}}

		case "robonew_render_video":
			name, _ := callParams.Arguments["name"].(string)
			outputName, _ := callParams.Arguments["outputName"].(string)
			dir := filepath.Join(root, name)
			err := s.renderManager.StartRender(dir, outputName, nil)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": "Render started."}}}}

		case "robonew_generate_deck":
			topic, _ := callParams.Arguments["topic"].(string)
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			deck, err := GenerateDeckContent(ctx, s.configManager, topic)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			slug := fmt.Sprintf("deck-ai-%d", time.Now().Unix()%100000)
			dir, err := CreateFromTemplate(root, "beeknoee-slide-starter", slug, s.templatesDir)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			if err := ApplyGeneratedDeck(dir, deck); err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			// Synthesize voice
			fullText := strings.Join(deck.ScriptLines, " ")
			outDir := filepath.Join(dir, "output")
			_ = os.MkdirAll(outDir, 0755)
			targetVoiceover := filepath.Join(outDir, "full_voiceover.mp3")
			voicePath, err := SynthesizeVoice(ctx, fullText, "", "vbee", s.configManager, outDir)
			if err != nil || voicePath == "" {
				voicePath, err = SynthesizeVoice(ctx, fullText, "", "edge", s.configManager, outDir)
			}
			if err == nil && voicePath != "" {
				_ = os.Remove(targetVoiceover)
				_ = os.Rename(voicePath, targetVoiceover)
			}
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": fmt.Sprintf("Generated AI deck '%s' at %s with %d script lines.", deck.Topic, dir, len(deck.ScriptLines))}}}}

		case "robonew_test_ai":
			bUrl, _ := callParams.Arguments["baseUrl"].(string)
			key, _ := callParams.Arguments["apiKey"].(string)
			mdl, _ := callParams.Arguments["model"].(string)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			res, err := TestAIConnection(ctx, bUrl, key, mdl)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			out, _ := json.MarshalIndent(res, "", "  ")
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": string(out)}}}}

		case "robonew_tts_synthesize":
			txt, _ := callParams.Arguments["text"].(string)
			eng, _ := callParams.Arguments["engine"].(string)
			vc, _ := callParams.Arguments["voice"].(string)
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			tmpOut := filepath.Join(os.TempDir(), "robonew_tts_test")
			_ = os.MkdirAll(tmpOut, 0755)
			p, err := SynthesizeVoice(ctx, txt, vc, eng, s.configManager, tmpOut)
			if err != nil {
				return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: err.Error()}
			}
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Result: map[string]interface{}{"content": []map[string]interface{}{{"type": "text", "text": "Synthesized audio at: " + p}}}}

		default:
			return &MCPResponse{JSONRPC: "2.0", ID: req.ID, Error: "Unknown tool: " + callParams.Name}
		}

	default:
		return &MCPResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error:   "Method not found: " + req.Method,
		}
	}
}
