/** All CSS for the support widget, injected into Shadow DOM. */

export const WIDGET_STYLES = `
:host {
  all: initial;
  --sm-primary: #2563eb;
  --sm-primary-hover: #1d4ed8;
  --sm-primary-disabled: #93c5fd;
  --sm-primary-text: #ffffff;
  --sm-visitor-bubble: var(--sm-primary);
  --sm-visitor-text: var(--sm-primary-text);
  --sm-rep-bubble: #f3f4f6;
  --sm-rep-text: #1f2937;
  --sm-bubble-radius: 16px;
  --sm-panel-width: 380px;
  --sm-panel-height: 560px;
  --sm-badge-bg: #ef4444;
  --sm-bubble-left: auto;
  --sm-bubble-right: 20px;
  --sm-panel-left: auto;
  --sm-panel-right: 20px;
  --sm-font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --sm-font-size: 14px;
  font-family: var(--sm-font-family);
  font-size: var(--sm-font-size);
  line-height: 1.5;
  color: #111827;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.sm-bubble {
  position: fixed;
  bottom: 20px;
  left: var(--sm-bubble-left);
  right: var(--sm-bubble-right);
  width: 60px;
  height: 60px;
  border-radius: 999px;
  background: var(--sm-primary);
  color: var(--sm-primary-text);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 999999;
}

.sm-bubble:hover {
  transform: translateY(-1px) scale(1.03);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.28);
}

.sm-bubble .sm-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--sm-badge-bg);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
}

.sm-panel {
  position: fixed;
  bottom: 90px;
  left: var(--sm-panel-left);
  right: var(--sm-panel-right);
  width: var(--sm-panel-width);
  max-height: min(var(--sm-panel-height), calc(100vh - 110px));
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 999998;
  animation: sm-slide-up 0.22s ease;
}

@keyframes sm-slide-up {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}

.sm-panel.sm-hidden {
  display: none;
}

.sm-header {
  background: var(--sm-primary);
  color: var(--sm-primary-text);
  padding: 16px 18px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.sm-header-copy {
  min-width: 0;
}

.sm-header-title {
  font-size: 16px;
  font-weight: 700;
}

.sm-header-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.92;
}

.sm-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.65);
}

.sm-status-dot-online {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.sm-status-dot-away {
  background: #cbd5e1;
}

.sm-header-subtitle {
  font-size: 12px;
  opacity: 0.82;
  margin-top: 6px;
  max-width: 250px;
}

.sm-header-actions {
  display: flex;
  gap: 6px;
}

.sm-header-btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  border-radius: 10px;
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.86;
}

.sm-header-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.12);
}

.sm-error {
  padding: 10px 14px;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 12px;
}

.sm-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.sm-prechat {
  padding: 20px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sm-prechat-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.sm-prechat-desc {
  font-size: 13px;
  color: #6b7280;
}

.sm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sm-field label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.sm-field input,
.sm-field textarea,
.sm-input {
  border: 1px solid #d1d5db;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  color: #111827;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  background: #fff;
}

.sm-field input:focus,
.sm-field textarea:focus,
.sm-input:focus {
  border-color: var(--sm-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.sm-field textarea {
  resize: vertical;
  min-height: 92px;
}

.sm-prechat-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.sm-submit-btn,
.sm-send-btn {
  border: none;
  cursor: pointer;
  background: var(--sm-primary);
  color: var(--sm-primary-text);
  transition: background 0.15s ease, opacity 0.15s ease;
}

.sm-submit-btn:hover,
.sm-send-btn:hover {
  background: var(--sm-primary-hover);
}

.sm-submit-btn:disabled,
.sm-send-btn:disabled {
  background: var(--sm-primary-disabled);
  cursor: not-allowed;
}

.sm-submit-btn {
  flex: 1;
  border-radius: 14px;
  padding: 12px;
  font-size: 14px;
  font-weight: 700;
}

.sm-chat-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  position: relative;
}

.sm-chat-shell.sm-dragging {
  background: rgba(37, 99, 235, 0.05);
}

.sm-messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sm-date-divider {
  align-self: center;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  background: rgba(148, 163, 184, 0.16);
  padding: 4px 10px;
  border-radius: 999px;
}

.sm-unread-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  font-weight: 700;
  color: var(--sm-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sm-unread-divider::before,
.sm-unread-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(37, 99, 235, 0.24);
}

.sm-msg {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 84%;
}

.sm-msg-visitor {
  align-self: flex-end;
}

.sm-msg-rep {
  align-self: flex-start;
}

.sm-msg-system {
  align-self: center;
  max-width: 92%;
}

.sm-msg-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.sm-msg-bubble {
  padding: 10px 12px;
  border-radius: var(--sm-bubble-radius);
  line-height: 1.4;
  word-break: break-word;
  background: var(--sm-rep-bubble);
  color: var(--sm-rep-text);
}

.sm-msg-content {
  white-space: pre-wrap;
}

.sm-msg-visitor .sm-msg-bubble {
  background: var(--sm-visitor-bubble);
  color: var(--sm-visitor-text);
  border-bottom-right-radius: 6px;
}

.sm-msg-rep .sm-msg-bubble {
  border-bottom-left-radius: 6px;
}

.sm-msg-system .sm-msg-bubble {
  background: transparent;
  color: #94a3b8;
  font-size: 12px;
  text-align: center;
  padding: 2px 8px;
}

.sm-msg-action {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #6b7280;
  border-radius: 999px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.sm-msg-action:hover {
  color: var(--sm-primary);
  border-color: rgba(37, 99, 235, 0.24);
}

.sm-msg-time {
  font-size: 11px;
  color: #94a3b8;
}

.sm-msg-visitor .sm-msg-time {
  text-align: right;
}

.sm-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sm-reaction-badge {
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #374151;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.sm-reaction-badge-active {
  border-color: rgba(37, 99, 235, 0.32);
  background: rgba(37, 99, 235, 0.08);
  color: var(--sm-primary);
}

.sm-reaction-picker {
  display: inline-flex;
  gap: 6px;
  padding: 6px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

.sm-reaction-picker-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 999px;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
}

.sm-attachment {
  display: block;
  margin-top: 8px;
  border-radius: 12px;
  max-width: 100%;
}

.sm-attachment-image,
.sm-attachment-video {
  max-width: 260px;
}

.sm-attachment-audio {
  width: 100%;
}

.sm-attachment-link {
  color: inherit;
  text-decoration: underline;
  font-size: 13px;
}

.sm-typing {
  min-height: 22px;
  padding: 0 16px 10px;
  font-size: 12px;
  color: #6b7280;
}

.sm-typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.sm-typing-indicator span:nth-child(-n+3) {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #94a3b8;
  animation: sm-bounce 1.2s infinite ease-in-out;
}

.sm-typing-indicator span:nth-child(2) {
  animation-delay: 0.15s;
}

.sm-typing-indicator span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes sm-bounce {
  0%, 80%, 100% { transform: scale(0.85); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.sm-upload-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 10px;
}

.sm-upload-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  padding: 6px 10px;
  font-size: 12px;
  color: #374151;
}

.sm-upload-chip-error {
  border-color: #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

.sm-upload-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sm-upload-progress {
  color: #6b7280;
}

.sm-upload-chip-error .sm-upload-progress {
  color: inherit;
}

.sm-upload-remove {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.sm-input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.sm-input {
  flex: 1;
  min-height: 44px;
  max-height: 100px;
  resize: none;
  overflow-y: auto;
  line-height: 1.4;
}

.sm-attach-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  color: #374151;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sm-attach-btn:hover {
  border-color: rgba(37, 99, 235, 0.28);
  color: var(--sm-primary);
}

.sm-send-btn {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sm-footer {
  text-align: center;
  padding: 8px;
  font-size: 11px;
  color: #94a3b8;
}

.sm-footer a {
  color: #6b7280;
  text-decoration: none;
}

.sm-footer a:hover {
  text-decoration: underline;
}

.sm-drag-overlay {
  position: absolute;
  inset: 0;
  background: rgba(37, 99, 235, 0.08);
  border: 2px dashed var(--sm-primary);
  border-radius: 12px;
  display: none;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--sm-primary);
  pointer-events: none;
  z-index: 10;
}

.sm-chat-shell.sm-dragging .sm-drag-overlay {
  display: flex;
}

@media (max-width: 440px) {
  .sm-panel {
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    max-height: 100vh;
    border-radius: 18px 18px 0 0;
  }
}
`;
