    // =========================================================
    // PENOVA AI — Application State & Persistence
    // =========================================================
    const STORAGE_KEYS = {
      NOTES: 'penova_notes_v1',
      TRANSCRIPT: 'penova_transcript_v1',
      STATS: 'penova_stats_v1',
      API_KEY: 'penova_gemini_key_v1',
      MODEL: 'penova_gemini_model_v1'
    };

    const VIEW_META = {
      dashboard: { title: 'Dashboard', subtitle: 'WRITE. RECORD. LEARN. — Student Study Hub' },
      notes: { title: 'Digital Notes', subtitle: 'Write, edit, save locally & export PDF' },
      lecture: { title: 'Lecture Assistant', subtitle: 'Paste or dictate lecture transcripts for AI processing' },
      summary: { title: 'AI Summary', subtitle: 'Powered by Google Gemini AI' },
      exam: { title: 'AI Exam Maker', subtitle: 'MCQs, short & long questions with answer keys' },
      revision: { title: 'Smart Revision', subtitle: 'Interactive quiz & score tracker' },
      pen: { title: 'Pen Connection', subtitle: 'PROTOTYPE SIMULATION — Smart Pen Telemetry' },
      underline: { title: 'Double Underline Demo', subtitle: 'Interactive handwritten stroke-to-highlight demo' }
    };

    const SAMPLE_LECTURE_TEXT = `Today's lecture covers Artificial Neural Networks and Backpropagation.
A biological neuron receives signals through dendrites, processes them in the cell body, and fires an output through the axon. Similarly, an artificial neuron (perceptron) takes multiple numerical inputs, multiplies each by a learnable weight, adds a bias term, and passes the result through a non-linear activation function such as ReLU (Rectified Linear Unit) or Sigmoid.

Without non-linear activation functions, a deep neural network would collapse into a simple linear regression model regardless of how many layers it has.

Training a neural network involves two main passes:
1. Forward Propagation: Input data flows layer by layer to produce a prediction, which is compared against the true label using a Loss Function (such as Mean Squared Error for regression or Cross-Entropy Loss for classification).
2. Backpropagation and Gradient Descent: Using the chain rule of calculus, we compute the gradient of the loss with respect to every weight in the network. An optimizer like SGD or Adam then updates each weight in the opposite direction of the gradient scaled by the learning rate.

Key challenges include Overfitting (where the model memorizes training data and fails to generalize) and Vanishing Gradients. Solutions include Dropout regularization, Batch Normalization, residual skip connections, and early stopping.`;

    let state = {
      currentView: 'dashboard',
      notes: [],
      activeNoteId: null,
      transcript: '',
      stats: { summariesGenerated: 0, examsGenerated: 0, quizScores: [] },
      apiKey: '',
      model: 'gemini-2.5-flash',
      lastSummary: null,
      lastExam: null,
      showExamAnswers: true,
      quiz: {
        questions: [],
        index: 0,
        selected: null,
        checked: false,
        answers: [],
        finished: false
      },
      penSim: {
        connected: true,
        battery: 84,
        charging: false
      }
    };

    // =========================================================
    // Utilities
    // =========================================================
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function showToast(message, type = 'info') {
      const stack = document.getElementById('toastStack');
      const el = document.createElement('div');
      el.className = `toast ${type}`;
      el.textContent = message;
      stack.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
        el.style.transition = 'all 0.2s ease';
        setTimeout(() => el.remove(), 220);
      }, 3400);
    }

    function formatDate(ts) {
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function countWords(text) {
      const trimmed = text.trim();
      return trimmed ? trimmed.split(/\s+/).length : 0;
    }

    function renderAlert(containerId, type, title, message, includeApiBtn = false) {
      const el = document.getElementById(containerId);
      if (!el) return;
      if (!message) { el.innerHTML = ''; return; }
      el.innerHTML = `
        <div class="alert-box alert-${type}">
          <div style="flex:1;">
            <strong>${escapeHtml(title)}</strong>
            <div style="margin-top:4px;">${escapeHtml(message)}</div>
            ${includeApiBtn ? `<div style="margin-top:10px;"><button class="btn btn-primary btn-sm" onclick="openApiModal()">Configure Gemini API Key</button></div>` : ''}
          </div>
        </div>
      `;
    }

    // =========================================================
    // Initialization & Storage
    // =========================================================
    function loadState() {
      try {
        const rawNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
        if (rawNotes) {
          state.notes = JSON.parse(rawNotes);
        } else {
          // Starter sample note (clearly labeled as sample, not AI output)
          state.notes = [
            {
              id: 'sample-note-1',
              title: 'Sample Study Note — Neural Networks',
              tag: 'Sample Note',
              body: 'Perceptron = weighted sum + bias + activation function (ReLU / Sigmoid).\n\nBackpropagation uses the chain rule to compute gradients so Gradient Descent can minimize the loss function.\n\nWatch out for overfitting — use Dropout or Early Stopping.',
              updatedAt: Date.now()
            }
          ];
          localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
        }

        const rawTranscript = localStorage.getItem(STORAGE_KEYS.TRANSCRIPT);
        if (rawTranscript) state.transcript = rawTranscript;

        const rawStats = localStorage.getItem(STORAGE_KEYS.STATS);
        if (rawStats) state.stats = { ...state.stats, ...JSON.parse(rawStats) };

        state.apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY) || '';
        const savedModel = localStorage.getItem(STORAGE_KEYS.MODEL);
        const allowedModels = Array.from(document.querySelectorAll('#geminiModelSelect option')).map(o => o.value);
        state.model = allowedModels.includes(savedModel) ? savedModel : 'gemini-2.5-flash';
      } catch (e) {
        console.error('Failed to load local storage:', e);
      }

      if (state.notes.length > 0) {
        state.activeNoteId = state.notes[0].id;
      }
    }

    function saveNotesToStorage() {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(state.notes));
    }

    function saveStatsToStorage() {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(state.stats));
    }

    // =========================================================
    // Navigation
    // =========================================================
    function navigateTo(view) {
      if (!VIEW_META[view]) return;
      state.currentView = view;

      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`view-${view}`).classList.add('active');

      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });

      document.querySelectorAll('.mob-nav-btn[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
      });

      document.getElementById('topbarTitle').textContent = VIEW_META[view].title;
      document.getElementById('topbarSubtitle').textContent = VIEW_META[view].subtitle;

      if (view === 'dashboard') refreshDashboard();
      if (view === 'notes') renderNotesModule();
      if (view === 'lecture') syncTranscriptUI();
      if (view === 'summary') checkSummaryPrereq();
      if (view === 'exam') checkExamPrereq();
      if (view === 'revision') checkRevisionPrereq();

      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function closeMobileDrawer() {
      document.getElementById('mobileDrawer').classList.remove('open');
    }

    // =========================================================
    // Dashboard
    // =========================================================
    function refreshDashboard() {
      const notesCount = state.notes.length;
      const sumCount = state.stats.summariesGenerated || 0;
      const examCount = state.stats.examsGenerated || 0;
      const scores = state.stats.quizScores || [];
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

      document.getElementById('statNotesCount').textContent = notesCount;
      document.getElementById('barNotes').style.width = `${Math.min(100, notesCount * 20)}%`;

      document.getElementById('statSummariesCount').textContent = sumCount;
      document.getElementById('barSummaries').style.width = `${Math.min(100, sumCount * 25)}%`;

      document.getElementById('statExamsCount').textContent = examCount;
      document.getElementById('barExams').style.width = `${Math.min(100, examCount * 25)}%`;

      document.getElementById('statQuizAvg').textContent = avg !== null ? `${avg}%` : '—';
      document.getElementById('barQuizAvg').style.width = `${avg !== null ? avg : 0}%`;

      document.getElementById('navNotesCount').textContent = notesCount;

      const recentBox = document.getElementById('dashboardRecentNotes');
      if (state.notes.length === 0) {
        recentBox.innerHTML = `<div style="color:var(--text-muted);font-size:0.84rem;padding:12px;">No saved notes yet. Click "+ New Note" to start writing!</div>`;
      } else {
        recentBox.innerHTML = state.notes.slice(0, 4).map(n => `
          <div class="note-item" onclick="openNoteInEditor('${escapeHtml(n.id)}')">
            <div class="note-item-title">${escapeHtml(n.title || 'Untitled Note')}</div>
            <div class="note-item-meta">
              <span>${escapeHtml(n.tag || 'General')}</span>
              <span>${formatDate(n.updatedAt)}</span>
            </div>
          </div>
        `).join('');
      }

      const tWords = countWords(state.transcript);
      const tTag = document.getElementById('dashTranscriptTag');
      const tPrev = document.getElementById('dashTranscriptPreview');
      if (tWords > 0) {
        tTag.textContent = `${tWords} words ready`;
        tTag.className = 'tag-pill tag-real';
        tPrev.textContent = state.transcript.slice(0, 260) + (state.transcript.length > 260 ? '...' : '');
      } else {
        tTag.textContent = 'No Active Transcript';
        tTag.className = 'tag-pill';
        tPrev.textContent = 'No lecture transcript loaded yet. Paste one in Lecture Assistant or load the demo transcript to test Gemini AI.';
      }
    }

    function openNoteInEditor(id) {
      state.activeNoteId = id;
      navigateTo('notes');
    }

    function createNewNoteAndNavigate() {
      createNewBlankNote();
      navigateTo('notes');
    }

    // =========================================================
    // Digital Notes + PDF Export
    // =========================================================
    function createNewBlankNote() {
      const note = {
        id: 'note-' + Date.now(),
        title: '',
        tag: '',
        body: '',
        updatedAt: Date.now()
      };
      state.notes.unshift(note);
      state.activeNoteId = note.id;
      saveNotesToStorage();
      renderNotesModule();
      document.getElementById('noteTitleInput').focus();
    }

    function renderNotesModule() {
      const query = (document.getElementById('noteSearchInput').value || '').toLowerCase();
      const filtered = state.notes.filter(n =>
        (n.title || '').toLowerCase().includes(query) ||
        (n.tag || '').toLowerCase().includes(query) ||
        (n.body || '').toLowerCase().includes(query)
      );

      const listEl = document.getElementById('notesListContainer');
      if (filtered.length === 0) {
        listEl.innerHTML = `<div style="font-size:0.82rem;color:var(--text-muted);padding:10px;">No matching notes found.</div>`;
      } else {
        listEl.innerHTML = filtered.map(n => `
          <div class="note-item ${n.id === state.activeNoteId ? 'active' : ''}" onclick="selectNote('${escapeHtml(n.id)}')">
            <div class="note-item-title">${escapeHtml(n.title || 'Untitled Note')}</div>
            <div class="note-item-meta">
              <span>${escapeHtml(n.tag || 'General')}</span>
              <span>${formatDate(n.updatedAt)}</span>
            </div>
          </div>
        `).join('');
      }

      const active = state.notes.find(n => n.id === state.activeNoteId);
      const titleIn = document.getElementById('noteTitleInput');
      const tagIn = document.getElementById('noteTagInput');
      const bodyIn = document.getElementById('noteBodyInput');
      const metaEl = document.getElementById('noteMetaInfo');

      if (active) {
        titleIn.value = active.title;
        tagIn.value = active.tag;
        bodyIn.value = active.body;
        metaEl.textContent = `Last saved: ${formatDate(active.updatedAt)}`;
        updateNoteWordCount();
      } else {
        titleIn.value = '';
        tagIn.value = '';
        bodyIn.value = '';
        metaEl.textContent = 'Create a new note or select one from the list';
        updateNoteWordCount();
      }

      document.getElementById('navNotesCount').textContent = state.notes.length;
    }

    function renderNotesList() {
      const query = (document.getElementById('noteSearchInput').value || '').toLowerCase();
      const filtered = state.notes.filter(n =>
        (n.title || '').toLowerCase().includes(query) ||
        (n.tag || '').toLowerCase().includes(query) ||
        (n.body || '').toLowerCase().includes(query)
      );
      const listEl = document.getElementById('notesListContainer');
      listEl.innerHTML = filtered.length === 0
        ? `<div style="font-size:0.82rem;color:var(--text-muted);padding:10px;">No matching notes found.</div>`
        : filtered.map(n => `
          <div class="note-item ${n.id === state.activeNoteId ? 'active' : ''}" onclick="selectNote('${escapeHtml(n.id)}')">
            <div class="note-item-title">${escapeHtml(n.title || 'Untitled Note')}</div>
            <div class="note-item-meta"><span>${escapeHtml(n.tag || 'General')}</span><span>${formatDate(n.updatedAt)}</span></div>
          </div>`).join('');
    }

    let autosaveTimer = null;
    function doAutosave() {
      autosaveTimer = null;
      const active = state.notes.find(n => n.id === state.activeNoteId);
      if (!active) return;
      active.title = document.getElementById('noteTitleInput').value.trim();
      active.tag = document.getElementById('noteTagInput').value.trim();
      active.body = document.getElementById('noteBodyInput').value;
      active.updatedAt = Date.now();
      saveNotesToStorage();
      renderNotesList();
    }
    function queueAutosave() {
      updateNoteWordCount();
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(doAutosave, 600);
    }
    function flushAutosave() {
      if (autosaveTimer) { clearTimeout(autosaveTimer); doAutosave(); }
    }

    function selectNote(id) {
      flushAutosave();
      state.activeNoteId = id;
      renderNotesModule();
    }

    function updateNoteWordCount() {
      const body = document.getElementById('noteBodyInput').value;
      document.getElementById('noteWordCount').textContent = `${countWords(body)} words • ${body.length} characters`;
    }

    function saveCurrentNote() {
      const title = document.getElementById('noteTitleInput').value.trim();
      const tag = document.getElementById('noteTagInput').value.trim();
      const body = document.getElementById('noteBodyInput').value;

      if (!title && !body.trim()) {
        showToast('Please enter a note title or content before saving.', 'error');
        return;
      }

      let active = state.notes.find(n => n.id === state.activeNoteId);
      if (!active) {
        active = { id: 'note-' + Date.now(), title, tag, body, updatedAt: Date.now() };
        state.notes.unshift(active);
        state.activeNoteId = active.id;
      } else {
        active.title = title || 'Untitled Note';
        active.tag = tag || 'General';
        active.body = body;
        active.updatedAt = Date.now();
      }

      saveNotesToStorage();
      renderNotesModule();
      refreshDashboard();
      showToast('Note saved locally!', 'success');
    }

    function deleteCurrentNote() {
      if (!state.activeNoteId) {
        showToast('No note selected to delete.', 'error');
        return;
      }
      if (!confirm('Delete this note permanently?')) return;
      state.notes = state.notes.filter(n => n.id !== state.activeNoteId);
      state.activeNoteId = state.notes.length ? state.notes[0].id : null;
      saveNotesToStorage();
      renderNotesModule();
      refreshDashboard();
      showToast('Note deleted.', 'info');
    }

    function generatePdfDocument(title, subtitle, bodyText, filename) {
      if (window.jspdf && window.jspdf.jsPDF) {
        try {
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF({ unit: 'pt', format: 'a4' });
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const margin = 44;
          const maxWidth = pageWidth - margin * 2;

          // Brand Header
          doc.setFillColor(24, 16, 48);
          doc.rect(0, 0, pageWidth, 68, 'F');
          doc.setTextColor(237, 233, 254);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          doc.text('PENOVA AI', margin, 30);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(196, 181, 253);
          doc.text('WRITE. RECORD. LEARN.', margin, 47);

          // Title & Subtitle
          let y = 98;
          doc.setTextColor(25, 20, 45);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(16);
          const titleLines = doc.splitTextToSize(title || 'PENOVA AI Document', maxWidth);
          doc.text(titleLines, margin, y);
          y += titleLines.length * 20 + 4;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(105, 95, 130);
          doc.text(subtitle || `Exported ${new Date().toLocaleDateString()}`, margin, y);
          y += 22;

          doc.setDrawColor(196, 181, 253);
          doc.line(margin, y, pageWidth - margin, y);
          y += 20;

          // Body
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);
          doc.setTextColor(35, 35, 45);
          const lines = doc.splitTextToSize(bodyText || '', maxWidth);

          for (let i = 0; i < lines.length; i++) {
            if (y > pageHeight - 50) {
              doc.addPage();
              y = 50;
            }
            doc.text(lines[i], margin, y);
            y += 16;
          }

          doc.save(filename);
          showToast(`PDF downloaded: ${filename}`, 'success');
          return;
        } catch (err) {
          console.error('jsPDF error:', err);
        }
      }

      // Reliable Offline Fallback
      showToast('PDF library unavailable offline — opening Print-to-PDF dialog.', 'info');
      const w = window.open('', '_blank');
      if (w) {
        w.document.write('<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.5;">' + escapeHtml(title + '\n' + (subtitle || '') + '\n\n' + (bodyText || '')) + '</pre>');
        w.document.close();
        w.print();
      } else {
        showToast('Popup blocked — allow popups to print/save PDF.', 'error');
      }
    }

    // =========================================================
    // Lecture Assistant & Voice Dictation
    // =========================================================
    function syncTranscriptUI() {
      const area = document.getElementById('lectureTranscriptInput');
      if (area.value !== state.transcript) area.value = state.transcript;
      document.getElementById('transcriptStats').textContent = `${countWords(area.value)} words`;
    }

    function updateTranscript(val) {
      state.transcript = val;
      localStorage.setItem(STORAGE_KEYS.TRANSCRIPT, val);
      document.getElementById('transcriptStats').textContent = `${countWords(val)} words`;
    }

    let recognition = null;
    let isListening = false;

    function toggleVoiceDictation() {
      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRec) {
        renderAlert('lectureErrorArea', 'error', 'Voice Dictation Not Supported', 'Your current browser does not support Web Speech API dictation. Please paste or type your lecture transcript, or try Chrome / Edge.');
        return;
      }

      if (isListening && recognition) {
        recognition.stop();
        return;
      }

      recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        isListening = true;
        document.getElementById('voiceBtnLabel').textContent = 'Stop Listening...';
        showToast('Microphone dictation started.', 'info');
      };

      recognition.onresult = (event) => {
        let added = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) added += event.results[i][0].transcript + ' ';
        }
        if (added) {
          const area = document.getElementById('lectureTranscriptInput');
          area.value = (area.value ? area.value.trimEnd() + ' ' : '') + added;
          updateTranscript(area.value);
        }
      };

      recognition.onerror = (event) => {
        renderAlert('lectureErrorArea', 'error', 'Microphone Error', `Speech recognition error: ${event.error}. Ensure microphone permission is granted.`);
      };

      recognition.onend = () => {
        isListening = false;
        document.getElementById('voiceBtnLabel').textContent = 'Start Mic Dictation';
      };

      recognition.start();
    }

    // =========================================================
    // Gemini AI Integration (Real API Calls Only)
    // =========================================================
    function updateApiStatusUI() {
      const hasKey = Boolean(state.apiKey && state.apiKey.trim());
      document.getElementById('apiDot').className = hasKey ? 'dot dot-green' : 'dot dot-amber';
      document.getElementById('apiStatusLabel').textContent = hasKey ? `Gemini: ${state.model}` : 'Gemini API: Not Set';
      document.getElementById('topApiBtnText').textContent = hasKey ? 'Gemini Ready' : 'Set API Key';
    }

    function openApiModal() {
      document.getElementById('geminiApiKeyInput').value = state.apiKey;
      document.getElementById('geminiModelSelect').value = state.model;
      document.getElementById('apiModal').classList.add('open');
    }

    function closeApiModal() {
      document.getElementById('apiModal').classList.remove('open');
    }

    function extractJsonFromText(rawText) {
      let cleaned = rawText.trim();
      const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
      if (fenceMatch && fenceMatch[1]) cleaned = fenceMatch[1].trim();
      return JSON.parse(cleaned);
    }

    async function callGeminiJson(prompt) {
      if (!state.apiKey || !state.apiKey.trim()) {
        throw new Error('NO_API_KEY');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(state.model)}:generateContent`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': state.apiKey.trim() },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: 'application/json'
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        let apiMsg = data?.error?.message || `HTTP ${response.status} error from Gemini API.`;
        if (response.status === 400 && /API key/i.test(apiMsg)) apiMsg = 'Invalid API key. Please check your Gemini key in Config.';
        if (response.status === 404) apiMsg = 'Selected model not found. Choose another model in Config. (' + apiMsg + ')';
        if (response.status === 429) apiMsg = 'Quota / rate limit reached. Wait a minute and try again.';
        throw new Error(apiMsg);
      }

      const textPart = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textPart) {
        throw new Error('Gemini returned an empty response. Try again or verify your lecture text.');
      }

      try {
        return extractJsonFromText(textPart);
      } catch (e) {
        throw new Error('AI response could not be parsed cleanly as JSON. Please try generating again.');
      }
    }

    function validateAiPrerequisites(statusContainerId) {
      if (!state.apiKey || !state.apiKey.trim()) {
        renderAlert(
          statusContainerId,
          'warn',
          'Gemini API Key Required for Real AI Generation',
          'PENOVA AI does not fake AI output. Please enter your Google Gemini API key to generate real summaries, exams, and quizzes.',
          true
        );
        return false;
      }
      if (!state.transcript || countWords(state.transcript) < 12) {
        renderAlert(
          statusContainerId,
          'error',
          'Lecture Transcript Needed',
          'Please paste at least a short paragraph of lecture content in Lecture Assistant first (or click "Load Sample Lecture").'
        );
        return false;
      }
      return true;
    }

    // 4. AI SUMMARY
    function checkSummaryPrereq() {
      if (!state.lastSummary) {
        if (!state.apiKey) {
          renderAlert('summaryStatusArea', 'warn', 'Gemini API Key Required', 'Configure your Gemini API key to generate real AI lecture summaries.', true);
        } else if (!state.transcript || countWords(state.transcript) < 12) {
          renderAlert('summaryStatusArea', 'info', 'Ready for Lecture Input', 'Paste a lecture transcript in Lecture Assistant, then click "Generate AI Summary".');
        } else {
          renderAlert('summaryStatusArea', '', '', '');
        }
      }
    }

    async function generateAiSummary() {
      if (!validateAiPrerequisites('summaryStatusArea')) return;

      const btn = document.getElementById('generateSummaryBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Analyzing with Gemini...';
      document.getElementById('summaryStatusArea').innerHTML = '';

      const prompt = `You are PENOVA AI, an expert university study assistant. Analyze the following lecture transcript and return a JSON object with this exact schema:
{
  "summary": "A clear, well-structured 1-2 paragraph overview of the lecture.",
  "importantPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "definitions": [
    { "term": "Term Name", "definition": "Clear concise academic definition." }
  ],
  "keyConcepts": [
    { "concept": "Concept Title", "explanation": "Brief explanation of why this concept matters." }
  ]
}

Lecture Transcript:
"""
${state.transcript.slice(0, 18000)}
"""`;

      try {
        const result = await callGeminiJson(prompt);
        state.lastSummary = result;
        state.stats.summariesGenerated = (state.stats.summariesGenerated || 0) + 1;
        saveStatsToStorage();

        renderSummaryOutput(result);
        showToast('AI Summary generated by Gemini!', 'success');
      } catch (err) {
        if (err.message === 'NO_API_KEY') {
          validateAiPrerequisites('summaryStatusArea');
        } else {
          renderAlert('summaryStatusArea', 'error', 'Gemini AI Error', err.message, true);
          showToast('Failed to generate AI summary.', 'error');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate AI Summary';
      }
    }

    function renderSummaryOutput(data) {
      document.getElementById('summaryResultArea').style.display = 'block';
      document.getElementById('summaryModelBadge').textContent = `Generated via ${state.model}`;
      document.getElementById('summaryTextOut').textContent = data.summary || 'No summary text returned.';

      const points = Array.isArray(data.importantPoints) ? data.importantPoints : [];
      document.getElementById('summaryPointsOut').innerHTML = points.map(p => `<li>• ${escapeHtml(p)}</li>`).join('') || '<li>No points returned.</li>';

      const defs = Array.isArray(data.definitions) ? data.definitions : [];
      document.getElementById('summaryDefinitionsOut').innerHTML = defs.map(d => `
        <li>
          <span class="def-term">${escapeHtml(d.term)}</span>
          ${escapeHtml(d.definition)}
        </li>
      `).join('') || '<li>No definitions returned.</li>';

      const concepts = Array.isArray(data.keyConcepts) ? data.keyConcepts : [];
      document.getElementById('summaryConceptsOut').innerHTML = concepts.map(c => `
        <div class="concept-card">
          <h4>${escapeHtml(c.concept)}</h4>
          <p>${escapeHtml(c.explanation)}</p>
        </div>
      `).join('') || '<p>No key concepts returned.</p>';

      document.getElementById('saveSummaryToNotesBtn').disabled = false;
      document.getElementById('exportSummaryPdfBtn').disabled = false;
    }

    // 5. AI EXAM MAKER
    function checkExamPrereq() {
      if (!state.lastExam) {
        if (!state.apiKey) {
          renderAlert('examStatusArea', 'warn', 'Gemini API Key Required', 'Configure your Gemini API key to generate custom exam papers.', true);
        } else if (!state.transcript || countWords(state.transcript) < 12) {
          renderAlert('examStatusArea', 'info', 'Ready for Lecture Input', 'Paste a lecture transcript in Lecture Assistant, then click "Generate Exam Paper".');
        } else {
          renderAlert('examStatusArea', '', '', '');
        }
      }
    }

    async function generateAiExam() {
      if (!validateAiPrerequisites('examStatusArea')) return;

      const difficulty = document.getElementById('examDifficultySelect').value;
      const btn = document.getElementById('generateExamBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Crafting Exam...';
      document.getElementById('examStatusArea').innerHTML = '';

      const prompt = `You are PENOVA AI, a university professor creating an exam at "${difficulty}" level based ONLY on the provided lecture transcript.
Return strictly valid JSON with this exact schema:
{
  "mcqs": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this option is correct."
    }
  ],
  "shortQuestions": [
    { "question": "Short question?", "answer": "Concise 2-3 sentence model answer." }
  ],
  "longQuestions": [
    { "question": "Analytical essay question?", "answer": "Detailed structured model answer outline." }
  ]
}
Include 5 MCQs, 3 short questions, and 2 long questions.

Lecture Transcript:
"""
${state.transcript.slice(0, 18000)}
"""`;

      try {
        const result = await callGeminiJson(prompt);
        state.lastExam = result;
        state.stats.examsGenerated = (state.stats.examsGenerated || 0) + 1;
        saveStatsToStorage();

        renderExamOutput();
        showToast('AI Exam Paper created!', 'success');
      } catch (err) {
        if (err.message === 'NO_API_KEY') {
          validateAiPrerequisites('examStatusArea');
        } else {
          renderAlert('examStatusArea', 'error', 'Gemini AI Error', err.message, true);
          showToast('Failed to generate exam paper.', 'error');
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Generate Exam Paper';
      }
    }

    function renderExamOutput() {
      const exam = state.lastExam;
      if (!exam) return;

      document.getElementById('examResultArea').style.display = 'block';
      document.getElementById('toggleExamAnswersBtn').disabled = false;
      document.getElementById('exportExamPdfBtn').disabled = false;
      document.getElementById('toggleExamAnswersBtn').textContent = state.showExamAnswers ? 'Hide Answers' : 'Show Answers';

      const mcqs = Array.isArray(exam.mcqs) ? exam.mcqs : [];
      document.getElementById('examMcqsOut').innerHTML = mcqs.map((q, idx) => {
        const letters = ['A', 'B', 'C', 'D'];
        const optsHtml = (q.options || []).map((opt, oi) => {
          const isCorrect = state.showExamAnswers && oi === q.correctIndex;
          return `<div style="padding:7px 10px;border-radius:8px;margin-top:5px;font-size:0.84rem;background:${isCorrect ? 'rgba(52,211,153,0.14)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isCorrect ? 'rgba(52,211,153,0.4)' : 'rgba(196,181,253,0.1)'};">
            <strong>${letters[oi] || oi + 1}.</strong> ${escapeHtml(opt)} ${isCorrect ? ' ✓' : ''}
          </div>`;
        }).join('');

        return `
          <div class="question-card">
            <div style="font-weight:700;font-size:0.93rem;margin-bottom:8px;">Q${idx + 1}. ${escapeHtml(q.question)}</div>
            ${optsHtml}
            ${state.showExamAnswers && q.explanation ? `<div class="answer-reveal"><strong>Answer (${letters[q.correctIndex] || ''}):</strong> ${escapeHtml(q.explanation)}</div>` : ''}
          </div>
        `;
      }).join('');

      const shorts = Array.isArray(exam.shortQuestions) ? exam.shortQuestions : [];
      document.getElementById('examShortOut').innerHTML = shorts.map((q, idx) => `
        <div class="question-card">
          <div style="font-weight:700;font-size:0.9rem;">${idx + 1}. ${escapeHtml(q.question)}</div>
          ${state.showExamAnswers ? `<div class="answer-reveal"><strong>Model Answer:</strong> ${escapeHtml(q.answer)}</div>` : ''}
        </div>
      `).join('');

      const longs = Array.isArray(exam.longQuestions) ? exam.longQuestions : [];
      document.getElementById('examLongOut').innerHTML = longs.map((q, idx) => `
        <div class="question-card">
          <div style="font-weight:700;font-size:0.9rem;">${idx + 1}. ${escapeHtml(q.question)}</div>
          ${state.showExamAnswers ? `<div class="answer-reveal"><strong>Marking Guide:</strong> ${escapeHtml(q.answer)}</div>` : ''}
        </div>
      `).join('');
    }

    // 6. SMART REVISION QUIZ
    function checkRevisionPrereq() {
      const importBtn = document.getElementById('importExamMcqsBtn');
      importBtn.style.display = (state.lastExam && state.lastExam.mcqs?.length) ? 'inline-flex' : 'none';

      if (state.quiz.questions.length === 0) {
        if (!state.apiKey) {
          renderAlert('quizStatusArea', 'warn', 'Gemini API Key Required', 'Configure your Gemini API key to generate interactive Smart Revision quizzes.', true);
        } else if (!state.transcript || countWords(state.transcript) < 12) {
          renderAlert('quizStatusArea', 'info', 'No Lecture Loaded', 'Paste a lecture transcript in Lecture Assistant to launch a Smart Revision quiz.');
        } else {
          renderAlert('quizStatusArea', 'info', 'Ready to Start', 'Click "New AI Quiz from Lecture" above to test your knowledge!');
        }
      }
    }

    async function generateSmartRevisionQuiz() {
      if (!validateAiPrerequisites('quizStatusArea')) return;

      const btn = document.getElementById('generateQuizBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Building Quiz...';
      document.getElementById('quizStatusArea').innerHTML = '';

      const prompt = `Create a 5-question multiple-choice revision quiz from the lecture transcript below.
Return strictly valid JSON:
{
  "questions": [
    {
      "question": "Clear question?",
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctIndex": 0,
      "explanation": "Short helpful explanation."
    }
  ]
}

Lecture Transcript:
"""
${state.transcript.slice(0, 18000)}
"""`;

      try {
        const result = await callGeminiJson(prompt);
        const questions = Array.isArray(result.questions) ? result.questions : [];
        if (!questions.length) throw new Error('No quiz questions returned by Gemini.');
        startQuizWithQuestions(questions);
        showToast('Smart Revision quiz ready!', 'success');
      } catch (err) {
        if (err.message === 'NO_API_KEY') {
          validateAiPrerequisites('quizStatusArea');
        } else {
          renderAlert('quizStatusArea', 'error', 'Gemini AI Error', err.message, true);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'New AI Quiz from Lecture';
      }
    }

    function startQuizWithQuestions(questions) {
      state.quiz = {
        questions,
        index: 0,
        selected: null,
        checked: false,
        answers: [],
        finished: false
      };
      document.getElementById('quizStatusArea').innerHTML = '';
      renderQuizStage();
    }

    function renderQuizStage() {
      const stage = document.getElementById('quizStageArea');
      stage.style.display = 'block';
      const qz = state.quiz;

      if (qz.finished) {
        const total = qz.questions.length;
        const correctCount = qz.answers.filter(a => a.isCorrect).length;
        const pct = Math.round((correctCount / total) * 100);
        const badge = pct >= 80 ? 'Exam Ready! Outstanding mastery.' : pct >= 60 ? 'Good progress — review missed concepts.' : 'Keep studying — review AI Summary & retry!';

        stage.innerHTML = `
          <div class="card" style="text-align:center;margin-bottom:16px;">
            <div class="score-ring" style="--pct:${pct}%;">
              <span>${pct}%</span>
            </div>
            <h3 style="font-size:1.3rem;margin-bottom:4px;">You scored ${correctCount} out of ${total}</h3>
            <p style="color:var(--lavender-soft);font-size:0.9rem;margin-bottom:16px;">${badge}</p>
            <div class="btn-row" style="justify-content:center;">
              <button class="btn btn-primary" onclick="startQuizWithQuestions(state.quiz.questions)">Retake This Quiz</button>
              <button class="btn btn-secondary" onclick="generateSmartRevisionQuiz()">Generate Fresh AI Quiz</button>
            </div>
          </div>

          <div class="card">
            <h4 style="margin-bottom:12px;">Answer Breakdown</h4>
            ${qz.questions.map((item, i) => {
              const ans = qz.answers[i];
              return `
                <div class="question-card">
                  <div style="display:flex;justify-content:space-between;gap:8px;">
                    <strong>Q${i + 1}. ${escapeHtml(item.question)}</strong>
                    <span class="tag-pill ${ans.isCorrect ? 'tag-real' : ''}" style="${ans.isCorrect ? '' : 'background:rgba(251,113,133,0.16);color:#fecdd3;border-color:rgba(251,113,133,0.4);'}">${ans.isCorrect ? 'Correct' : 'Missed'}</span>
                  </div>
                  <div style="font-size:0.83rem;margin-top:6px;color:var(--text-muted);">
                    Your answer: <strong style="color:#fff;">${escapeHtml(item.options[ans.selected] || 'None')}</strong> •
                    Correct: <strong style="color:#a7f3d0;">${escapeHtml(item.options[item.correctIndex])}</strong>
                  </div>
                  ${item.explanation ? `<div class="answer-reveal">${escapeHtml(item.explanation)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;
        return;
      }

      const current = qz.questions[qz.index];
      const total = qz.questions.length;
      const pctProgress = Math.round(((qz.index + (qz.checked ? 1 : 0)) / total) * 100);
      const letters = ['A', 'B', 'C', 'D'];

      stage.innerHTML = `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;font-size:0.82rem;color:var(--lavender-soft);">
            <span>Question ${qz.index + 1} of ${total}</span>
            <span>${pctProgress}% Complete</span>
          </div>
          <div class="progress-track" style="margin-bottom:18px;">
            <div class="progress-fill" style="width:${pctProgress}%"></div>
          </div>

          <h3 style="font-size:1.06rem;line-height:1.45;margin-bottom:12px;">${escapeHtml(current.question)}</h3>

          <div>
            ${(current.options || []).map((opt, idx) => {
              let cls = 'option-btn';
              if (qz.checked) {
                if (idx === current.correctIndex) cls += ' correct';
                else if (idx === qz.selected) cls += ' wrong';
              } else if (idx === qz.selected) {
                cls += ' selected';
              }
              return `
                <button class="${cls}" onclick="selectQuizOption(${idx})" ${qz.checked ? 'disabled' : ''}>
                  <span class="tag-pill" style="min-width:28px;justify-content:center;">${letters[idx] || idx + 1}</span>
                  <span>${escapeHtml(opt)}</span>
                </button>
              `;
            }).join('')}
          </div>

          ${qz.checked && current.explanation ? `
            <div class="answer-reveal" style="margin-top:14px;">
              <strong>${qz.selected === current.correctIndex ? 'Correct!' : 'Review:'}</strong> ${escapeHtml(current.explanation)}
            </div>
          ` : ''}

          <div class="btn-row" style="justify-content:flex-end;margin-top:18px;">
            ${!qz.checked
              ? `<button class="btn btn-primary" onclick="checkQuizAnswer()" ${qz.selected === null ? 'disabled' : ''}>Check Answer</button>`
              : `<button class="btn btn-primary" onclick="nextQuizQuestion()">${qz.index + 1 < total ? 'Next Question →' : 'Finish & View Score'}</button>`
            }
          </div>
        </div>
      `;
    }

    function selectQuizOption(idx) {
      if (state.quiz.checked) return;
      state.quiz.selected = idx;
      renderQuizStage();
    }

    function checkQuizAnswer() {
      const qz = state.quiz;
      if (qz.selected === null) return;
      const current = qz.questions[qz.index];
      qz.checked = true;
      qz.answers.push({
        selected: qz.selected,
        isCorrect: qz.selected === current.correctIndex
      });
      renderQuizStage();
    }

    function nextQuizQuestion() {
      const qz = state.quiz;
      if (qz.index + 1 < qz.questions.length) {
        qz.index += 1;
        qz.selected = null;
        qz.checked = false;
      } else {
        qz.finished = true;
        const correct = qz.answers.filter(a => a.isCorrect).length;
        const pct = Math.round((correct / qz.questions.length) * 100);
        state.stats.quizScores = state.stats.quizScores || [];
        state.stats.quizScores.push(pct);
        saveStatsToStorage();
        refreshDashboard();
        showToast(`Quiz finished! Score: ${pct}%`, 'success');
      }
      renderQuizStage();
    }

    // =========================================================
    // 7. Pen Connection Simulator
    // =========================================================
    function updatePenSimUI() {
      const sim = state.penSim;
      document.getElementById('penBatteryPct').textContent = `${sim.battery}%${sim.charging ? ' ⚡' : ''}`;
      document.getElementById('penBatteryFill').style.width = `${sim.battery}%`;
      document.getElementById('penBatteryEstimate').textContent = sim.charging
        ? 'Charging via USB-C Magnetic Dock (Simulated)'
        : `Est. ${Math.round(sim.battery * 0.17)}h writing time left`;

      document.getElementById('sidebarPenBat').textContent = `${sim.battery}%`;

      const ring = document.getElementById('penPulseRing');
      const led = document.getElementById('penLedBar');
      const connText = document.getElementById('penConnText');
      const toggleBtn = document.getElementById('togglePenConnBtn');
      const sigVal = document.getElementById('penSignalVal');

      if (sim.connected) {
        ring.classList.remove('paused');
        led.setAttribute('fill', '#d946ef');
        connText.textContent = 'Status: Connected via BLE 5.3 (Prototype Simulation)';
        toggleBtn.textContent = 'Simulate Disconnect';
        sigVal.textContent = '-46 dBm (Strong)';
        document.getElementById('sidebarPenDot').className = 'dot dot-green';
        document.getElementById('sidebarPenLabel').textContent = 'Pen Sim: Paired';
      } else {
        ring.classList.add('paused');
        led.setAttribute('fill', '#52525b');
        connText.textContent = 'Status: Disconnected (Prototype Simulation)';
        toggleBtn.textContent = 'Simulate Bluetooth Pair';
        sigVal.textContent = 'No Signal';
        document.getElementById('sidebarPenDot').className = 'dot dot-amber';
        document.getElementById('sidebarPenLabel').textContent = 'Pen Sim: Offline';
      }
    }

    // =========================================================
    // 8. Double Underline Interactive Demo
    // =========================================================
    function refreshExtractedHighlights() {
      const phrases = Array.from(document.querySelectorAll('#handwrittenDemoSheet .hand-phrase.double-underlined'))
        .map(el => el.dataset.phrase);

      const badge = document.getElementById('extractedCountBadge');
      const list = document.getElementById('extractedHighlightsList');
      badge.textContent = `${phrases.length} Highlighted`;

      if (phrases.length === 0) {
        list.innerHTML = `<li style="color:var(--text-muted);">No double-underlined phrases selected. Tap any phrase on the handwritten sheet!</li>`;
      } else {
        list.innerHTML = phrases.map((p, idx) => `
          <li>
            <span class="tag-pill" style="margin-right:8px;">#${idx + 1}</span>
            <strong>${escapeHtml(p)}</strong>
          </li>
        `).join('');
      }
    }

    // =========================================================
    // Event Listeners
    // =========================================================
    function bindEvents() {
      // Sidebar & mobile nav
      document.querySelectorAll('.nav-btn[data-view], .mob-nav-btn[data-view]').forEach(btn => {
        btn.addEventListener('click', () => navigateTo(btn.dataset.view));
      });

      document.getElementById('mobileMoreBtn').addEventListener('click', () => {
        document.getElementById('mobileDrawer').classList.add('open');
      });
      document.getElementById('closeMobileDrawerBtn').addEventListener('click', closeMobileDrawer);
      document.getElementById('mobileDrawer').addEventListener('click', (e) => {
        if (e.target.id === 'mobileDrawer') closeMobileDrawer();
      });

      // API Modal
      document.getElementById('openApiModalBtn').addEventListener('click', openApiModal);
      document.getElementById('topApiBtn').addEventListener('click', openApiModal);
      document.getElementById('closeApiModalBtn').addEventListener('click', closeApiModal);
      document.getElementById('cancelApiModalBtn').addEventListener('click', closeApiModal);

      document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
        state.apiKey = document.getElementById('geminiApiKeyInput').value.trim();
        state.model = document.getElementById('geminiModelSelect').value;
        localStorage.setItem(STORAGE_KEYS.API_KEY, state.apiKey);
        localStorage.setItem(STORAGE_KEYS.MODEL, state.model);
        updateApiStatusUI();
        closeApiModal();
        showToast(state.apiKey ? `Gemini settings saved (${state.model}).` : 'API key cleared.', 'success');
        if (state.currentView === 'summary') checkSummaryPrereq();
        if (state.currentView === 'exam') checkExamPrereq();
        if (state.currentView === 'revision') checkRevisionPrereq();
      });

      document.getElementById('clearApiKeyBtn').addEventListener('click', () => {
        state.apiKey = '';
        localStorage.removeItem(STORAGE_KEYS.API_KEY);
        document.getElementById('geminiApiKeyInput').value = '';
        updateApiStatusUI();
        showToast('Gemini API key removed.', 'info');
      });

      // Digital Notes
      document.getElementById('newNoteBtn').addEventListener('click', createNewBlankNote);
      document.getElementById('saveNoteBtn').addEventListener('click', saveCurrentNote);
      document.getElementById('deleteNoteBtn').addEventListener('click', deleteCurrentNote);
      document.getElementById('noteSearchInput').addEventListener('input', renderNotesList);
      ['noteTitleInput', 'noteTagInput', 'noteBodyInput'].forEach(id =>
        document.getElementById(id).addEventListener('input', queueAutosave));

      document.getElementById('exportNotePdfBtn').addEventListener('click', () => {
        const title = document.getElementById('noteTitleInput').value.trim() || 'Untitled Note';
        const tag = document.getElementById('noteTagInput').value.trim() || 'Digital Note';
        const body = document.getElementById('noteBodyInput').value;
        if (!body.trim()) {
          showToast('Write some note content before exporting PDF.', 'error');
          return;
        }
        generatePdfDocument(title, `Subject: ${tag} • Exported from PENOVA AI`, body, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
      });

      document.getElementById('sendNoteToLectureBtn').addEventListener('click', () => {
        const body = document.getElementById('noteBodyInput').value.trim();
        if (!body) { showToast('Note is empty.', 'error'); return; }
        updateTranscript(body);
        navigateTo('lecture');
        showToast('Note loaded into Lecture Assistant!', 'success');
      });

      // Lecture Assistant
      document.getElementById('lectureTranscriptInput').addEventListener('input', (e) => {
        updateTranscript(e.target.value);
      });

      document.getElementById('loadSampleTranscriptBtn').addEventListener('click', () => {
        document.getElementById('lectureTranscriptInput').value = SAMPLE_LECTURE_TEXT;
        updateTranscript(SAMPLE_LECTURE_TEXT);
        renderAlert('lectureErrorArea', '', '', '');
        showToast('Sample lecture transcript loaded (demo input).', 'info');
      });

      document.getElementById('clearTranscriptBtn').addEventListener('click', () => {
        document.getElementById('lectureTranscriptInput').value = '';
        updateTranscript('');
        showToast('Transcript cleared.', 'info');
      });

      document.getElementById('saveTranscriptAsNoteBtn').addEventListener('click', () => {
        const text = document.getElementById('lectureTranscriptInput').value.trim();
        if (!text) { showToast('Transcript is empty.', 'error'); return; }
        const note = {
          id: 'note-' + Date.now(),
          title: 'Lecture Transcript — ' + new Date().toLocaleDateString(),
          tag: 'Lecture',
          body: text,
          updatedAt: Date.now()
        };
        state.notes.unshift(note);
        state.activeNoteId = note.id;
        saveNotesToStorage();
        refreshDashboard();
        showToast('Transcript saved to Digital Notes!', 'success');
      });

      document.getElementById('voiceDictateBtn').addEventListener('click', toggleVoiceDictation);

      document.getElementById('runSummaryFromLectureBtn').addEventListener('click', () => {
        navigateTo('summary');
        generateAiSummary();
      });
      document.getElementById('runExamFromLectureBtn').addEventListener('click', () => {
        navigateTo('exam');
        generateAiExam();
      });
      document.getElementById('runQuizFromLectureBtn').addEventListener('click', () => {
        navigateTo('revision');
        generateSmartRevisionQuiz();
      });

      // AI Summary
      document.getElementById('generateSummaryBtn').addEventListener('click', generateAiSummary);

      document.getElementById('saveSummaryToNotesBtn').addEventListener('click', () => {
        if (!state.lastSummary) return;
        const s = state.lastSummary;
        const formatted = [
          'SUMMARY:\n' + (s.summary || ''),
          '\nIMPORTANT POINTS:\n' + (s.importantPoints || []).map(p => '- ' + p).join('\n'),
          '\nDEFINITIONS:\n' + (s.definitions || []).map(d => `${d.term}: ${d.definition}`).join('\n'),
          '\nKEY CONCEPTS:\n' + (s.keyConcepts || []).map(c => `${c.concept}: ${c.explanation}`).join('\n')
        ].join('\n');

        const note = {
          id: 'note-' + Date.now(),
          title: 'AI Summary — ' + new Date().toLocaleDateString(),
          tag: 'Gemini Summary',
          body: formatted,
          updatedAt: Date.now()
        };
        state.notes.unshift(note);
        state.activeNoteId = note.id;
        saveNotesToStorage();
        refreshDashboard();
        showToast('AI Summary saved to Digital Notes!', 'success');
      });

      document.getElementById('exportSummaryPdfBtn').addEventListener('click', () => {
        if (!state.lastSummary) return;
        const s = state.lastSummary;
        const text = [
          'LECTURE SUMMARY\n' + (s.summary || ''),
          '\n\nIMPORTANT POINTS\n' + (s.importantPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
          '\n\nKEY DEFINITIONS\n' + (s.definitions || []).map(d => `• ${d.term}: ${d.definition}`).join('\n'),
          '\n\nKEY CONCEPTS\n' + (s.keyConcepts || []).map(c => `• ${c.concept}: ${c.explanation}`).join('\n')
        ].join('');
        generatePdfDocument('PENOVA AI — Lecture Summary', `Generated with ${state.model}`, text, 'penova_ai_summary.pdf');
      });

      // AI Exam Maker
      document.getElementById('generateExamBtn').addEventListener('click', generateAiExam);

      document.getElementById('toggleExamAnswersBtn').addEventListener('click', () => {
        state.showExamAnswers = !state.showExamAnswers;
        renderExamOutput();
      });

      document.getElementById('sendMcqsToRevisionBtn').addEventListener('click', () => {
        if (!state.lastExam?.mcqs?.length) return;
        navigateTo('revision');
        startQuizWithQuestions(state.lastExam.mcqs);
      });

      document.getElementById('exportExamPdfBtn').addEventListener('click', () => {
        if (!state.lastExam) return;
        const ex = state.lastExam;
        const letters = ['A', 'B', 'C', 'D'];
        let text = 'SECTION A: MULTIPLE CHOICE QUESTIONS\n\n';
        (ex.mcqs || []).forEach((q, i) => {
          text += `Q${i + 1}. ${q.question}\n`;
          (q.options || []).forEach((opt, oi) => { text += `   ${letters[oi]}. ${opt}\n`; });
          text += `   Answer: ${letters[q.correctIndex]} — ${q.explanation || ''}\n\n`;
        });
        text += '\nSECTION B: SHORT QUESTIONS\n\n';
        (ex.shortQuestions || []).forEach((q, i) => {
          text += `Q${i + 1}. ${q.question}\nAnswer: ${q.answer}\n\n`;
        });
        text += '\nSECTION C: LONG QUESTIONS\n\n';
        (ex.longQuestions || []).forEach((q, i) => {
          text += `Q${i + 1}. ${q.question}\nMarking Guide: ${q.answer}\n\n`;
        });
        generatePdfDocument('PENOVA AI — Generated Exam Paper', `Difficulty: ${document.getElementById('examDifficultySelect').value}`, text, 'penova_ai_exam.pdf');
      });

      // Smart Revision
      document.getElementById('generateQuizBtn').addEventListener('click', generateSmartRevisionQuiz);
      document.getElementById('importExamMcqsBtn').addEventListener('click', () => {
        if (state.lastExam?.mcqs?.length) startQuizWithQuestions(state.lastExam.mcqs);
      });

      // Pen Connection Simulator
      document.getElementById('togglePenConnBtn').addEventListener('click', () => {
        const btn = document.getElementById('togglePenConnBtn');
        if (!state.penSim.connected) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> Scanning BLE...';
          setTimeout(() => {
            state.penSim.connected = true;
            btn.disabled = false;
            updatePenSimUI();
            showToast('Simulated PENOVA SmartPen paired!', 'success');
          }, 950);
        } else {
          state.penSim.connected = false;
          updatePenSimUI();
          showToast('Simulated pen disconnected.', 'info');
        }
      });

      document.getElementById('simulateChargeBtn').addEventListener('click', () => {
        state.penSim.charging = !state.penSim.charging;
        if (state.penSim.charging && state.penSim.battery < 98) {
          state.penSim.battery = Math.min(100, state.penSim.battery + 6);
        }
        updatePenSimUI();
      });

      document.getElementById('syncPenNotesBtn').addEventListener('click', () => {
        if (!state.penSim.connected) {
          showToast('Connect the simulated pen first before syncing!', 'error');
          return;
        }
        const btn = document.getElementById('syncPenNotesBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Syncing Strokes...';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = 'Simulate Note Sync';
          document.getElementById('penBufferVal').textContent = '0 pages queued (Synced)';
          const syncedNote = {
            id: 'pen-sync-' + Date.now(),
            title: 'Synced Pen Note (Simulated) — Bio 204',
            tag: 'PENOVA Pen Sync',
            body: 'Synced from PENOVA SmartPen Prototype Simulation:\n• ATP (Adenosine Triphosphate)\n• Glycolysis (occurs in the cytoplasm)\n• Electron Transport Chain generates ~32-34 ATP',
            updatedAt: Date.now()
          };
          state.notes.unshift(syncedNote);
          state.activeNoteId = syncedNote.id;
          saveNotesToStorage();
          refreshDashboard();
          showToast('Simulated handwritten note synced to Digital Notes!', 'success');
        }, 1000);
      });

      // Double Underline Demo
      document.querySelectorAll('#handwrittenDemoSheet .hand-phrase').forEach(el => {
        el.addEventListener('click', () => {
          el.classList.toggle('double-underlined');
          refreshExtractedHighlights();
        });
      });

      document.getElementById('resetUnderlineDemoBtn').addEventListener('click', () => {
        const defaults = new Set([
          'ATP (Adenosine Triphosphate)',
          'Glycolysis (occurs in the cytoplasm)',
          'Electron Transport Chain generates ~32-34 ATP'
        ]);
        document.querySelectorAll('#handwrittenDemoSheet .hand-phrase').forEach(el => {
          el.classList.toggle('double-underlined', defaults.has(el.dataset.phrase));
        });
        refreshExtractedHighlights();
        showToast('Double underline demo reset.', 'info');
      });

      document.getElementById('saveHighlightsNoteBtn').addEventListener('click', () => {
        const phrases = Array.from(document.querySelectorAll('#handwrittenDemoSheet .hand-phrase.double-underlined'))
          .map(el => '• ' + el.dataset.phrase);
        if (!phrases.length) {
          showToast('Highlight at least one phrase first.', 'error');
          return;
        }
        const note = {
          id: 'hl-' + Date.now(),
          title: 'Double-Underline Highlights — Bio 204',
          tag: 'Smart Highlights',
          body: 'Extracted via PENOVA Double-Underline Demo:\n\n' + phrases.join('\n'),
          updatedAt: Date.now()
        };
        state.notes.unshift(note);
        state.activeNoteId = note.id;
        saveNotesToStorage();
        refreshDashboard();
        showToast('Highlights saved to Digital Notes!', 'success');
      });

      document.getElementById('sendHighlightsToLectureBtn').addEventListener('click', () => {
        const sheetText = document.getElementById('handwrittenDemoSheet').innerText.trim();
        updateTranscript(sheetText);
        navigateTo('lecture');
        showToast('Handwritten demo text sent to Lecture Assistant!', 'success');
      });
    }

    // =========================================================
    // Boot
    // =========================================================
    document.addEventListener('DOMContentLoaded', () => {
      loadState();
      bindEvents();
      updateApiStatusUI();
      updatePenSimUI();
      refreshExtractedHighlights();
      refreshDashboard();
      renderNotesModule();
      syncTranscriptUI();
    });
