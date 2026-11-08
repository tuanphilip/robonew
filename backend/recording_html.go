package backend

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type SubtitleCaption struct {
	Index int     `json:"index"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
	Words []struct {
		Text  string  `json:"text"`
		Start float64 `json:"start"`
		End   float64 `json:"end"`
	} `json:"words"`
}

type SubtitleData struct {
	Captions []SubtitleCaption `json:"captions"`
}

const SubtitleCSS = `
.script-subtitles {
  position: fixed !important;
  bottom: 155px !important;
  left: 50% !important;
  right: auto !important;
  top: auto !important;
  transform: translateX(-50%) !important;
  width: max-content !important;
  max-width: 90% !important;
  z-index: 999999 !important;
  min-height: 0;
  display: flex !important;
  align-items: center;
  justify-content: center !important;
  padding: 8px 18px !important;
  background: rgba(0, 0, 0, 0.88) !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(255, 255, 255, 0.16) !important;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.9) !important;
  backdrop-filter: blur(10px) !important;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
}
.script-subtitles.visible { opacity: 1; }
.script-subtitle-line {
  display: inline-flex !important;
  width: auto;
  max-width: 100% !important;
  max-height: none !important;
  font-family: 'Lexend', 'SVN-Nexa', var(--font, sans-serif);
  font-size: 19px !important;
  font-weight: 700;
  line-height: 1.38;
  letter-spacing: 0.01em;
  text-align: center;
  flex-wrap: wrap !important;
  align-items: center;
  justify-content: center;
  gap: 0.08em 0.3em;
  overflow: visible !important;
  white-space: normal !important;
  transform-origin: center center;
}
.script-subtitle-word {
  flex: 0 0 auto;
  color: #e2e8f0;
  background: transparent !important;
  box-shadow: none !important;
  transition: color 0.05s linear, transform 0.08s ease, text-shadow 0.05s linear;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9);
}
.script-subtitle-word.past { color: #94a3b8; }
.script-subtitle-word.active {
  color: #facc15 !important;
  font-weight: 900 !important;
  transform: scale(1.18);
  text-shadow: 0 0 16px rgba(250, 204, 21, 0.9), 0 2px 4px #000000;
}
`

const SubtitleScript = `
(() => {
  const data = window.__SCRIPT_SUBTITLE_DATA__;
  if (!data || !Array.isArray(data.captions) || data.captions.length === 0) return;
  let overlay = null, line = null, startedAt = 0, raf = null;
  let lastCaptionIndex = -1, lastActiveWordIndex = -2;

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'script-subtitles';
    line = document.createElement('div');
    line.className = 'script-subtitle-line';
    overlay.appendChild(line);
    document.body.appendChild(overlay);

    function fitSubtitleScale() {
      // Pill shape wraps naturally, no scaling needed
    }
    window.__fitSubtitleScale = fitSubtitleScale;

    return overlay;
  }

  function findCaptionIndex(time) {
    const captions = data.captions;
    let candidate = -1;
    for (let i = 0; i < captions.length; i += 1) {
      const c = captions[i];
      if (time >= c.start && time <= c.end + 0.18) return i;
      if (c.start <= time) candidate = i;
      if (c.start > time) break;
    }
    return candidate;
  }

  function findActiveWordIndex(words, time) {
    let candidate = -1;
    for (let i = 0; i < words.length; i += 1) {
      const w = words[i];
      if (time >= w.start && time <= w.end + 0.08) return i;
      if (w.start <= time) candidate = i;
      if (w.start > time) break;
    }
    return candidate;
  }

  function renderWords(caption, activeWordIndex) {
    line.replaceChildren();
    caption.words.forEach((word, idx) => {
      const span = document.createElement('span');
      span.className = 'script-subtitle-word';
      if (idx < activeWordIndex) span.classList.add('past');
      else if (idx === activeWordIndex) span.classList.add('active');
      span.textContent = word.text;
      line.appendChild(span);
    });
  }

  function render(time) {
    ensureOverlay();
    const captions = data.captions;
    const idx = findCaptionIndex(time);
    if (idx < 0 || time > captions[captions.length - 1].end + 0.65) {
      overlay.classList.remove('visible');
      lastCaptionIndex = -1; lastActiveWordIndex = -2;
      return;
    }
    const caption = captions[idx];
    const hasWords = Array.isArray(caption.words) && caption.words.length > 0;
    const activeWordIndex = hasWords ? findActiveWordIndex(caption.words, time) : -1;
    if (idx !== lastCaptionIndex || activeWordIndex !== lastActiveWordIndex) {
      if (hasWords) renderWords(caption, activeWordIndex);
      else { line.textContent = caption.text; }
      if (typeof window.__fitSubtitleScale === 'function') {
        window.__fitSubtitleScale();
      }
      lastCaptionIndex = idx; lastActiveWordIndex = activeWordIndex;
    }
    overlay.classList.add('visible');
  }

  window.__syncSubtitleTime = (t) => {
    render(t);
  };
})();
`

func BuildRecordingCSS(w, h int, isVertical bool) string {
	baseW, baseH := 390.0, 693.0
	if !isVertical {
		baseW, baseH = 693.0, 390.0
	}
	zoom := float64(w) / baseW
	zoomH := float64(h) / baseH
	if zoomH < zoom {
		zoom = zoomH
	}

	return fmt.Sprintf(`
@font-face {
  font-family: 'Lexend';
  src: url('fonts/Lexend.ttf') format('truetype');
  font-weight: 100 900;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'SVN-Nexa';
  src: url('fonts/SVN-Nexa-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'SVN-Avo';
  src: url('fonts/SVN-Avo-Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'SVN-Avo';
  src: url('fonts/SVN-Avo-Bold.ttf') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}

html, body {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: #000 !important;
  scrollbar-width: none !important;
  cursor: none !important;
}
html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; }
* { cursor: none !important; }
.side-controls,
.script-panel,
.audio-panel,
.theme-editor-panel,
.progress-bar { display: none !important; }
.main-wrapper {
  position: static !important;
  display: block !important;
  margin: 0 !important; padding: 0 !important;
  transform: none !important;
}
.slide-container {
  position: fixed !important;
  top: 0 !important; left: 0 !important;
  width: %.0fpx !important;
  height: %.0fpx !important;
  border: 0 !important; border-radius: 0 !important;
  box-shadow: none !important;
  transform: scale(%.8f) !important;
  transform-origin: top left !important;
}
`, baseW, baseH, zoom)
}

func PrepareRecordingHtml(projectDir string, w, h int, isVertical bool, subData *SubtitleData) (string, error) {
	indexPath := filepath.Join(projectDir, "index.html")
	content, err := os.ReadFile(indexPath)
	if err != nil {
		return "", err
	}
	html := string(content)

	// Read preview-settings.json if present
	var previewSettings map[string]interface{}
	setPath := filepath.Join(projectDir, "preview-settings.json")
	if b, err := os.ReadFile(setPath); err == nil {
		_ = json.Unmarshal(b, &previewSettings)
	}
	setBytes, _ := json.Marshal(previewSettings)

	// Strip external network fonts to avoid blocking headless navigation
	html = strings.ReplaceAll(html, `https://fonts.googleapis.com`, `#`)
	html = strings.ReplaceAll(html, `https://fonts.gstatic.com`, `#`)
	html = strings.ReplaceAll(html, `https://cdnjs.cloudflare.com`, `#`)
	injectHead := fmt.Sprintf(`
<script>
  window.__RENDER_MODE__ = true;
  window.__PREVIEW_SETTINGS__ = %s;
  // Auto reveal slide 0 on load
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      const s0 = document.querySelector('.slide[data-slide="0"]');
      if (s0) {
        s0.classList.add('active');
        s0.querySelectorAll('.slide-element').forEach(function(el) { el.classList.add('visible'); });
      }
    }, 50);
  });
  // Render mode helper: show all elements in slide and go to slide directly
  window.__renderGoToSlide = function(idx) {
    if (typeof goToSlide === 'function') {
      goToSlide(idx);
    }
    const target = document.querySelector('.slide[data-slide="' + idx + '"]');
    if (target) {
      target.querySelectorAll('.slide-element').forEach(function(el) { el.classList.add('visible'); });
      target.querySelectorAll('.highlightable').forEach(function(el) { el.classList.add('highlighted'); });
      target.querySelectorAll('.lightable').forEach(function(el) {
        var col = el.dataset.lightColor || 'green';
        el.classList.add('lit-' + col);
      });
    }
  };

  // Trigger click dispatch helper with animation lock release
  window.__triggerSlideClick = function() {
    if (typeof isAnimating !== 'undefined') isAnimating = false;
    if (typeof isReady !== 'undefined') isReady = false;
    var c = document.getElementById('slideContainer') || document.body;
    if (typeof nextSlide === 'function') {
      nextSlide();
    } else if (typeof handleClick === 'function') {
      handleClick({ target: c, closest: function() { return null; } });
    } else {
      c.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
    var activeSlide = document.querySelector('.slide.active');
    if (activeSlide) {
      activeSlide.querySelectorAll('.slide-element').forEach(function(el) { el.classList.add('visible'); });
      activeSlide.querySelectorAll('.highlightable').forEach(function(el) { el.classList.add('highlighted'); });
      activeSlide.querySelectorAll('.lightable').forEach(function(el) {
        var col = el.dataset.lightColor || 'green';
        el.classList.add('lit-' + col);
      });
    }
  };
</script>
<style>
%s
%s
</style>
`, string(setBytes), BuildRecordingCSS(w, h, isVertical), SubtitleCSS)

	html = strings.Replace(html, "</head>", injectHead+"\n</head>", 1)

	// Inject Subtitle script & data
	if subData != nil {
		subBytes, _ := json.Marshal(subData)
		injectBody := fmt.Sprintf(`
<script>
  window.__SCRIPT_SUBTITLE_DATA__ = %s;
</script>
<script>
%s
</script>
`, string(subBytes), SubtitleScript)
		html = strings.Replace(html, "</body>", injectBody+"\n</body>", 1)
	}

	outPath := filepath.Join(projectDir, "_recording.html")
	err = os.WriteFile(outPath, []byte(html), 0644)
	return outPath, err
}
