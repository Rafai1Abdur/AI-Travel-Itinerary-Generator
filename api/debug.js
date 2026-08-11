// api/debug.js
// Diagnostic endpoint to check environment variable configuration status
// IMPORTANT: Do NOT deploy this to production - it reveals which keys are set (but not the keys themselves)

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Only show boolean status, never the actual key values
    res.status(200).json({
        configured: {
            openai: !!process.env.OPENAI_API_KEY,
            openrouter: !!process.env.OPENROUTER_API_KEY,
            ollama: !!process.env.OLLAMA_URL || process.env.OLLAMA_ENABLED === 'true',
            ollamaEnabled: process.env.OLLAMA_ENABLED === 'true'
        },
        envKeys: Object.keys(process.env).filter(k => /API|KEY|OLLAMA|OPENAI|OPENROUTER/i.test(k)),
        nodeEnv: process.env.NODE_ENV || 'not set'
    });
}