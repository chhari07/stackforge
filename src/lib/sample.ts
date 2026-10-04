"use client";

// The sample article for first launch and the empty screens' "Try it". It ships
// with the app, so it opens offline and with no account. One line comes
// already highlighted; the reader is asked to highlight one more, and both
// come back in the next morning's review.
import type { Article } from "./article";
import { addNote, getNotes } from "./db";
import { uiLang } from "./i18n";

export const SAMPLE_ID = "stack-sample";
export const SAMPLE_HREF = `/read?id=${SAMPLE_ID}`;

const TITLE = "Why you forget what you read";
export const SAMPLE_LINE = "Reading puts an idea in your head. Coming back to it is what keeps it there.";
const TITLE_HI = "पढ़ा हुआ हम क्यों भूल जाते हैं";
const SAMPLE_LINE_HI = "पढ़ने से कोई विचार दिमाग़ में आता है। उस पर लौटने से वह वहीं टिका रहता है।";
/** The ready-made highlight, in both languages (lib/i18n.ts). */
export const SAMPLE_LINES = [SAMPLE_LINE, SAMPLE_LINE_HI];

export const SAMPLE_ARTICLE: Article = {
  id: SAMPLE_ID,
  title: TITLE,
  source: "Stack",
  url: "https://stackforge.in",
  author: "A two-minute read to try Stack",
  readMinutes: 2,
  html: `
<p>You finish a good article, close the tab, and by the next day most of it has gone. That isn't a weak memory. It is how memory works.</p>
<p>In the 1880s the psychologist Hermann Ebbinghaus tested himself on lists he had learned and measured how fast they faded. The drop was steep at first and then slowed down. He called it the forgetting curve.</p>
<p>${SAMPLE_LINE}</p>
<p>Each time you recall something, just before you would have lost it, it fades more slowly than before. A line you meet again tomorrow, then in a few days, then in a few weeks, can stay with you for good.</p>
<p>That is all Stack does. When a line matters, select it and keep it. Every morning, three of the lines you kept come back for a few seconds each.</p>
<p>Try it now: select any sentence on this page and tap Highlight.</p>
`.trim(),
};

const SAMPLE_ARTICLE_HI: Article = {
  ...SAMPLE_ARTICLE,
  title: TITLE_HI,
  author: "Stack आज़माने के लिए दो मिनट का लेख",
  html: `
<p>आप कोई अच्छा लेख पढ़ते हैं, टैब बंद करते हैं, और अगले दिन तक उसका ज़्यादातर हिस्सा भूल जाते हैं। यह कमज़ोर याददाश्त नहीं है। याददाश्त ऐसे ही काम करती है।</p>
<p>1880 के दशक में मनोवैज्ञानिक हरमन एबिंगहॉस ने ख़ुद पर प्रयोग किया: उन्होंने याद की हुई सूचियाँ जाँचीं और मापा कि वे कितनी जल्दी भूलती हैं। शुरुआत में गिरावट तेज़ थी, फिर धीमी हो गई। उन्होंने इसे भूलने का वक्र (forgetting curve) कहा।</p>
<p>${SAMPLE_LINE_HI}</p>
<p>जब भी आप किसी चीज़ को भूलने से ठीक पहले याद करते हैं, वह पहले से धीरे भूलती है। जो लाइन आप कल फिर देखें, फिर कुछ दिन बाद, फिर कुछ हफ़्तों बाद, वह हमेशा के लिए याद रह सकती है।</p>
<p>Stack बस यही करता है। जब कोई लाइन ज़रूरी लगे, उसे चुनकर सहेज लें। हर सुबह आपकी सहेजी लाइनों में से तीन कुछ सेकंड के लिए लौटती हैं।</p>
<p>अभी आज़माएँ: इस पेज का कोई भी वाक्य चुनें और 'हाइलाइट' दबाएँ।</p>
`.trim(),
};

/** The sample in the app's language. */
export const sampleArticle = () => (uiLang() === "hi" ? SAMPLE_ARTICLE_HI : SAMPLE_ARTICLE);

/** Adds the sample's ready-made highlight, once. Like any highlight, it's due the next morning (lib/review.ts). */
export async function ensureSampleHighlight() {
  const notes = await getNotes();
  if (notes.some((n) => n.articleId === SAMPLE_ID && SAMPLE_LINES.includes(n.quote ?? ""))) return;
  const hindi = uiLang() === "hi";
  await addNote({
    kind: "article",
    quote: hindi ? SAMPLE_LINE_HI : SAMPLE_LINE,
    highlight: true,
    sourceTitle: hindi ? TITLE_HI : TITLE,
    sourceLabel: "Stack",
    articleId: SAMPLE_ID,
    href: SAMPLE_HREF,
  });
}
