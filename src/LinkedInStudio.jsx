import React, { useEffect, useMemo, useRef, useState } from "react";
import "./linkedin-studio.css";

const INITIAL_FORM = {
  topic: "",
  audience: "",
  details: "",
  purpose: "Share a lesson",
  tone: "Thoughtful and conversational",
  callToAction: "",
};

function makePrompt(form) {
  const topic = form.topic.trim();
  if (!topic) return "";

  const purposeLabels = {
    "Share a lesson": "Share a lesson or useful observation",
    "Build authority": "Explain a useful point clearly and credibly",
    "Announce work": "Announce or introduce a piece of work",
    "Ask a question": "Invite a thoughtful discussion",
  };

  return [
    "Help me prepare a LinkedIn post and a companion image prompt.",
    "",
    `TOPIC\n${topic}`,
    form.audience.trim() ? `\nAUDIENCE\n${form.audience.trim()}` : "",
    `\nPURPOSE\n${purposeLabels[form.purpose] || form.purpose}`,
    `\nTONE\n${form.tone}`,
    form.details.trim()
      ? `\nSOURCE DETAILS I PROVIDED\n${form.details.trim()}`
      : "\nSOURCE DETAILS I PROVIDED\nNone. Do not invent personal experiences, project results, statistics, credentials, or opinions for me. Keep the post useful and general, and flag any place where my own specific detail would improve it.",
    form.callToAction.trim() ? `\nOPTIONAL CALL TO ACTION\n${form.callToAction.trim()}` : "",
    "",
    "Please return:",
    "1. One polished LinkedIn post with a strong but natural opening, short readable paragraphs, and at most 3 relevant hashtags.",
    "2. If image generation is available in my ChatGPT account, create a separate companion image for this post. Use a clean, professional 1200 × 627 landscape composition, make it visually relevant to the post, and avoid legible text or logos in the image.",
    "3. Also provide the short image prompt separately, in case I need to use it in another image tool.",
    "Use only the facts and personal context I supplied. Do not add fabricated anecdotes, claims, metrics, outcomes, or credentials. Keep the writing human, specific, and free of hype.",
  ].filter(Boolean).join("\n");
}

function ArrowOut() {
  return <svg aria-hidden="true" viewBox="0 0 18 18"><path d="M4 14 14 4M6 4h8v8" /></svg>;
}

export default function LinkedInStudio() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [post, setPost] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageError, setImageError] = useState("");
  const [notice, setNotice] = useState("");
  const imageInputRef = useRef(null);
  const promptRef = useRef(null);
  const prompt = useMemo(() => makePrompt(form), [form]);
  const imageUrl = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : "", [imageFile]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setNotice("");
  }

  async function copyText(value, fallbackRef, successMessage) {
    try {
      if (!value.trim()) throw new Error("There is nothing to copy yet.");
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
    } catch {
      if (fallbackRef?.current) {
        fallbackRef.current.focus();
        fallbackRef.current.select();
      }
      setNotice("Clipboard access is unavailable. The text is selected; copy it with Ctrl+C or ⌘C.");
    }
  }

  function openChatGPT() {
    if (!prompt) {
      setNotice("Add a topic first to prepare your prompt.");
      return;
    }

    // Open synchronously from the click so browser popup protection allows the new tab.
    window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer");
    copyText(prompt, promptRef, "Prompt copied. Paste it into the new ChatGPT tab to draft your post and image prompt.");
  }

  function handleImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageError("");
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file to preview.");
      event.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setImageError("This image is over 15 MB. Choose a smaller file.");
      event.target.value = "";
      return;
    }
    setImageFile(file);
    setNotice("Image loaded for a local preview. It has not been uploaded.");
  }

  function clearStudio() {
    setForm(INITIAL_FORM);
    setPost("");
    setImageFile(null);
    setImageError("");
    setNotice("Studio cleared.");
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function downloadImage() {
    if (!imageUrl || !imageFile) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = imageFile.name || "linkedin-post-image";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setNotice("Image copy downloaded to your device.");
  }

  return (
    <section className="linkedin-studio" id="linkedin-studio" aria-labelledby="linkedin-studio-title">
      <div className="linkedin-studio-shell section-shell">
        <div className="linkedin-studio-topline">
          <p className="eyebrow"><span>05</span> LINKEDIN POST STUDIO</p>
          <span className="linkedin-studio-private mono"><i /> MANUAL CHATGPT HANDOFF / NO API</span>
        </div>

        <div className="linkedin-studio-heading">
          <div>
            <span className="linkedin-studio-edition mono">A WRITING + IMAGE DESK / 001</span>
            <h2 id="linkedin-studio-title">A post with<br /><em>a point.</em></h2>
          </div>
          <p>Shape a clear brief here, then use your ChatGPT account to create the post and companion image. Your portfolio cannot access your signed-in ChatGPT session directly.</p>
        </div>

        <div className="linkedin-studio-workspace">
          <form className="linkedin-brief" onSubmit={(event) => { event.preventDefault(); openChatGPT(); }}>
            <div className="linkedin-panel-title">
              <span className="mono">01 / YOUR BRIEF</span>
              <span className="linkedin-panel-rule" />
              <span className="mono">WRITE THE INPUT</span>
            </div>

            <label className="linkedin-field linkedin-field--wide">
              <span>What is the post about? <b>REQUIRED</b></span>
              <input name="topic" value={form.topic} onChange={updateField} placeholder="e.g. A lesson from building my first ERP" required />
            </label>

            <label className="linkedin-field linkedin-field--wide">
              <span>Who should it reach?</span>
              <input name="audience" value={form.audience} onChange={updateField} placeholder="e.g. Early-career developers" />
            </label>

            <label className="linkedin-field linkedin-field--wide">
              <span>Your story, key details, or takeaway</span>
              <textarea name="details" value={form.details} onChange={updateField} rows="4" placeholder="Add the facts and personal context you want included. The prompt tells ChatGPT not to make up missing details." />
            </label>

            <div className="linkedin-field-pair">
              <label className="linkedin-field">
                <span>Purpose</span>
                <select name="purpose" value={form.purpose} onChange={updateField}>
                  <option>Share a lesson</option>
                  <option>Build authority</option>
                  <option>Announce work</option>
                  <option>Ask a question</option>
                </select>
              </label>
              <label className="linkedin-field">
                <span>Tone</span>
                <select name="tone" value={form.tone} onChange={updateField}>
                  <option>Thoughtful and conversational</option>
                  <option>Direct and practical</option>
                  <option>Warm and encouraging</option>
                  <option>Concise and confident</option>
                  <option>Reflective and personal</option>
                </select>
              </label>
            </div>

            <label className="linkedin-field linkedin-field--wide">
              <span>Optional call to action</span>
              <input name="callToAction" value={form.callToAction} onChange={updateField} placeholder="e.g. What would you add?" />
            </label>

            <div className="linkedin-brief-actions">
              <button className="linkedin-launch" type="submit" disabled={!form.topic.trim()}>
                <span>COPY PROMPT &amp; OPEN CHATGPT</span><ArrowOut />
              </button>
              <button className="linkedin-reset" type="button" onClick={clearStudio}>CLEAR STUDIO</button>
            </div>
          </form>

          <aside className="linkedin-prompt-panel" aria-label="Prompt for ChatGPT">
            <div className="linkedin-panel-title">
              <span className="mono">02 / CHATGPT PROMPT</span>
              <span className="linkedin-panel-rule" />
              <span className="linkedin-prompt-state mono">{prompt ? "READY TO PASTE" : "WAITING FOR TOPIC"}</span>
            </div>
            <textarea
              ref={promptRef}
              className="linkedin-prompt-copy"
              aria-label="Prepared prompt to paste into ChatGPT"
              value={prompt || "Your prompt will appear here when you add a topic."}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <div className="linkedin-prompt-footer">
              <p><span>↳</span> The click opens ChatGPT and copies this prompt. Paste it there, ask ChatGPT to create the post and image, then download the image before returning here.</p>
              <button type="button" className="linkedin-copy-prompt" disabled={!prompt} onClick={() => copyText(prompt, promptRef, "Prompt copied to clipboard.")}>COPY PROMPT</button>
            </div>
            <p className="linkedin-handoff-note">Free-plan feature availability and usage limits can vary. This portfolio makes no API calls and cannot see the ChatGPT tab.</p>
          </aside>
        </div>

        <div className="linkedin-return-desk">
          <div className="linkedin-return-intro">
            <p className="eyebrow"><span>03</span> BRING IT BACK</p>
            <h3>Review the<br /><em>finished piece.</em></h3>
            <p>Paste the post from ChatGPT and choose its downloaded image. Both stay in this tab while you work.</p>
            <span className="linkedin-return-arrow" aria-hidden="true">↘</span>
          </div>

          <div className="linkedin-post-editor">
            <label className="linkedin-field linkedin-post-label" htmlFor="linkedin-post-output">
              <span>POST COPY <small>EDITABLE</small></span>
            </label>
            <textarea
              id="linkedin-post-output"
              className="linkedin-post-output"
              value={post}
              onChange={(event) => setPost(event.target.value)}
              placeholder="Paste the post ChatGPT returns here, then edit it until it sounds like you."
              rows="11"
            />
            <div className="linkedin-post-footer">
              <span className="mono">{post.length.toLocaleString()} CHARACTERS</span>
              <button type="button" className="linkedin-copy-post" disabled={!post.trim()} onClick={() => copyText(post, { current: document.getElementById("linkedin-post-output") }, "Post copied to clipboard.")}>COPY POST</button>
            </div>
          </div>

          <div className="linkedin-image-editor">
            <div className="linkedin-image-heading">
              <span className="mono">COMPANION IMAGE</span>
              <span className="linkedin-image-format mono">LOCAL PREVIEW</span>
            </div>
            <div className={`linkedin-image-preview${imageUrl ? " has-image" : ""}`}>
              {imageUrl ? <img src={imageUrl} alt="Locally selected LinkedIn post image preview" /> : (
                <div className="linkedin-image-empty">
                  <span className="linkedin-image-spark" aria-hidden="true">✳</span>
                  <span className="mono">1200 × 627 / IMAGE PREVIEW</span>
                  <p>Download your image from ChatGPT, then add it here.</p>
                </div>
              )}
            </div>
            <div className="linkedin-image-actions">
              <label className="linkedin-image-upload">
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImage} />
                <span>{imageFile ? "CHANGE IMAGE" : "ADD DOWNLOADED IMAGE"}</span><ArrowOut />
              </label>
              <button type="button" className="linkedin-copy-post" disabled={!imageUrl} onClick={downloadImage}>SAVE IMAGE COPY</button>
            </div>
            {imageError && <p className="linkedin-image-error" role="alert">{imageError}</p>}
          </div>
        </div>

        <div className="linkedin-studio-bottomline">
          <p className="linkedin-local-note"><span className="linkedin-local-pip" /> THIS PORTFOLIO DOES NOT UPLOAD OR PERSIST YOUR BRIEF, POST, OR IMAGE PREVIEW. YOU CHOOSE WHAT TO PASTE INTO CHATGPT.</p>
          <p className="linkedin-status" aria-live="polite">{notice || "Ready when you are."}</p>
        </div>
      </div>
    </section>
  );
}
