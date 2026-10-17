# Portfolio demo knowledge set

This bundled file is a small, local demonstration of the support assistant's retrieval feature. It is not a company policy document. It contains only details currently confirmed in the portfolio and the assistant setup. Add your own reviewed FAQ, Markdown, TXT, or PDF files to this directory when you want the assistant to answer additional questions.

## Owner and contact

The portfolio belongs to Muhammed Rashid PP. The contact email shown on the portfolio is rashid.mhd.pp@gmail.com. The listed phone number is +91 97453 93044 and its international dial string is +919745393044. A second listed email is muhammerashid12345@gmail.com. The portfolio links LinkedIn at linkedin.com/in/muhammedrashidpp/ and GitHub at github.com/Rashidrxq.

For a question this demo cannot confirm, the site offers email and phone links to contact Rashid directly. No support hours, response time, service-level agreement, or availability promise is specified here.

## Featured project: SalesOrder ERP

The portfolio features a project named SalesOrder ERP for Remex International. The portfolio describes its workflow as carrying an order through sales, inventory, production, billing, and dispatch. Its listed technology stack is Next.js, React, TypeScript, Prisma, PostgreSQL, and Tailwind CSS.

The repository link shown on the portfolio is https://github.com/Rashidrxq/SalesOrder-ERP-REMEX. The live demo link shown on the portfolio is https://sales-order-erp-remex.vercel.app/Auth/login. The portfolio marks the two featured artworks as generated concept imagery, not screenshots of the product.

## Resume ATS checker

The Resume ATS Checker accepts resume text or a PDF, DOCX, or TXT file. The text extraction and scan run in the browser. The score is a transparent, rule-based text estimate; it is not an employer's ATS result, hiring prediction, or guarantee. The scan looks at text signals such as contact details, common resume sections, action words, numbers, length, and optional job-description keyword overlap. Resume text and files are not uploaded by this tool or stored by it.

The file input is limited to 10 MB and the PDF extractor reads up to the first 35 pages. PDFs need selectable text; image-only scans are not OCR'd.

## LinkedIn Post Studio

The LinkedIn Post Studio prepares a prompt from a topic, optional audience and details, purpose, tone, and optional call to action. The user copies that prompt into their own ChatGPT account and brings any result back manually. The portfolio does not connect to a signed-in ChatGPT session and does not send a prompt through an OpenAI API. Whether ChatGPT can generate an image depends on the user's account and current limits. The studio can preview a user-selected image locally; its image picker does not upload the image to this portfolio.

## AI Travel Planner

The AI Travel Planner always has a local editable starter itinerary based on destination, dates, budget, travelers, pace, and selected interests. Its activity ideas are generic and its budget allocations are planning placeholders, not researched prices. The local planner does not perform live lookups for current prices, routes, hours, availability, weather, visa rules, or local conditions.

The **Build Starter Itinerary** action sends those trip details to OpenRouter through the Express server. It requests only the free `google/gemma-4-26b-a4b-it:free` model and does not use a paid-model fallback. A server-only `OPENROUTER_API_KEY` is required; without one, the local draft remains available. Model output is validated JSON, but it is not verified travel research and its costs, venue suggestions, and schedules are estimates. The planner also offers an optional manual ChatGPT prompt handoff; it does not access a signed-in ChatGPT session or use a ChatGPT API. Trip details and generated results stay in browser memory and are not stored by this portfolio.

## Portfolio content limits

The About section still contains editable starter copy for the owner's role, introduction, and capabilities. This demo knowledge set does not infer those details. If a question asks for personal history, services, prices, availability, policies, guarantees, or other facts not described here, the assistant should say it cannot confirm the answer and offer the human contact links.

## Portfolio support assistant

The support widget searches local Markdown, TXT, and PDF notes in the portfolio's `server/knowledge/` folder. When a local Ollama model is installed and running, the server sends the user question and a few retrieved notes to that local model for a grounded reply. If Ollama is unavailable, it shows matching note excerpts instead and labels them as a no-model response. If no notes match, it says it cannot confirm the answer and offers Rashid's contact links. The support widget does not use a paid AI API; the separate travel tool calls OpenRouter only after its explicit user action.

Chat history remains in the browser page's memory while that page is open; it is not saved to a database, local storage, or cookies. The widget does not let visitors upload documents. Sources displayed on a reply are generated from the notes retrieved by the server.
