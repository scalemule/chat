/** All CSS for the support widget, injected into Shadow DOM. */

export const WIDGET_STYLES = `
:host {
  all: initial;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* ============ Bubble ============ */

.sm-bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #2563eb;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  z-index: 999999;
}

.sm-bubble:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

.sm-bubble .sm-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: #fff;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
}

/* ============ Panel ============ */

.sm-panel {
  position: fixed;
  bottom: 90px;
  right: 20px;
  width: 380px;
  max-height: 560px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 999998;
  animation: sm-slide-up 0.25s ease;
}

@keyframes sm-slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.sm-panel.sm-hidden {
  display: none;
}

/* ============ Header ============ */

.sm-header {
  background: #2563eb;
  color: #fff;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sm-header-title {
  font-size: 16px;
  font-weight: 600;
}

.sm-header-subtitle {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 2px;
}

.sm-header-actions {
  display: flex;
  gap: 8px;
}

.sm-header-btn {
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  opacity: 0.8;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.sm-header-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* ============ Pre-chat form ============ */

.sm-prechat {
  padding: 24px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sm-prechat-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.sm-prechat-desc {
  font-size: 13px;
  color: #6b7280;
}

.sm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sm-field label {
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.sm-field input,
.sm-field textarea {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}

.sm-field input:focus,
.sm-field textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.sm-field textarea {
  resize: vertical;
  min-height: 80px;
}

.sm-submit-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.sm-submit-btn:hover {
  background: #1d4ed8;
}

.sm-submit-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

/* ============ Messages ============ */

.sm-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
  max-height: 360px;
}

.sm-msg {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.sm-msg.sm-msg-visitor {
  align-self: flex-end;
}

.sm-msg.sm-msg-rep {
  align-self: flex-start;
}

.sm-msg.sm-msg-system {
  align-self: center;
  max-width: 90%;
}

.sm-msg-bubble {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.sm-msg-visitor .sm-msg-bubble {
  background: #2563eb;
  color: #fff;
  border-bottom-right-radius: 4px;
}

.sm-msg-rep .sm-msg-bubble {
  background: #f3f4f6;
  color: #1a1a1a;
  border-bottom-left-radius: 4px;
}

.sm-msg-system .sm-msg-bubble {
  background: transparent;
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
  padding: 4px 8px;
}

.sm-msg-time {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

.sm-msg-visitor .sm-msg-time {
  text-align: right;
}

.sm-typing {
  font-size: 12px;
  color: #9ca3af;
  padding: 0 4px;
  min-height: 18px;
}

/* ============ Input ============ */

.sm-input-area {
  border-top: 1px solid #e5e7eb;
  padding: 12px 16px;
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.sm-input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 14px;
  font-family: inherit;
  outline: none;
  resize: none;
  max-height: 100px;
  overflow-y: auto;
  line-height: 1.4;
}

.sm-input:focus {
  border-color: #2563eb;
}

.sm-send-btn {
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

.sm-send-btn:hover {
  background: #1d4ed8;
}

.sm-send-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

/* ============ Footer ============ */

.sm-footer {
  text-align: center;
  padding: 8px;
  font-size: 11px;
  color: #9ca3af;
}

.sm-footer a {
  color: #6b7280;
  text-decoration: none;
}

.sm-footer a:hover {
  text-decoration: underline;
}

/* ============ Responsive ============ */

@media (max-width: 440px) {
  .sm-panel {
    bottom: 0;
    right: 0;
    left: 0;
    width: 100%;
    max-height: 100vh;
    border-radius: 16px 16px 0 0;
  }
}
`;
