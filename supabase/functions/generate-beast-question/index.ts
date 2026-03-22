// supabase/functions/generate-beast-question/index.ts
// ─── Multi-Provider AI Fallback Chain ────────────────────────────────────────
// الترتيب: Gemini → ChatGPT → Claude → Groq
// لو أي واحد فشل أو مش موجود key ينتقل للتالي تلقائياً
//
// Deploy: supabase functions deploy generate-beast-question
//
// أضف أي keys عندك (مش لازم كلهم):
//   supabase secrets set GEMINI_API_KEY=AIza...
//   supabase secrets set OPENAI_API_KEY=sk-...
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase secrets set GROQ_API_KEY=gsk_...

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildPrompt(specialty, level, usedTopics) {
    const difficulty = level <= 5  ? 'متوسطة'
                     : level <= 10 ? 'صعبة'
                     : 'صعبة جداً ونادرة ومتخصصة';
    const focus = level % 3 === 0 ? `متخصصة في ${specialty}`
                : level % 3 === 1 ? 'طبية عامة شاملة'
                : `متخصصة في ${specialty} مع ربط بتخصصات أخرى`;
    const avoid = usedTopics?.length > 0 ? `\nتجنب: ${usedTopics.join('، ')}` : '';
    return `أنت خبير امتحانات طبية. اكتب سؤالاً طبياً واحداً ${focus}، صعوبة: ${difficulty}، المستوى: ${level}/15.${avoid}
قواعد: السؤال عملي سريري، الخيارات الخاطئة محيّرة، المستوى 11-15 نادر وعميق جداً، لا تلميحات.
أجب بـ JSON فقط: {"question":"...","options":["أ","ب","ج","د"],"correct":0,"explanation":"...","topic":"..."}
correct = 0 إلى 3`;
}

function valid(d) {
    return d && typeof d.question === 'string' && d.question.length > 10
        && Array.isArray(d.options) && d.options.length === 4
        && d.options.every(o => typeof o === 'string' && o.length > 0)
        && typeof d.correct === 'number' && d.correct >= 0 && d.correct <= 3;
}

function parseJSON(text) {
    try { return JSON.parse(text); } catch { }
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
}

async function callGemini(prompt, key) {
    // جرب أكتر من model بالترتيب
    const models = [
        'gemini-2.0-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-002',
        'gemini-1.5-pro-latest',
        'gemini-pro',
    ];
    for (const model of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            const r = await fetch(url, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 800 } }),
            });
            if (!r.ok) {
                const errText = await r.text();
                if (r.status === 404) continue; // جرب المودل الجاي
                throw new Error(`Gemini ${r.status}: ${errText}`);
            }
            const d = await r.json();
            const q = parseJSON(d.candidates?.[0]?.content?.parts?.[0]?.text || '');
            if (!valid(q)) continue; // جرب المودل الجاي
            return { ...q, provider: `Gemini(${model})` };
        } catch (e) {
            if (String(e).includes('404')) continue;
            throw e;
        }
    }
    throw new Error('Gemini: all models failed');
}

async function callOpenAI(prompt, key) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
            model: 'gpt-4o-mini', max_tokens: 800, temperature: 0.7,
            messages: [{ role: 'system', content: 'أجب بـ JSON فقط.' }, { role: 'user', content: prompt }],
        }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const d = await r.json();
    const q = parseJSON(d.choices?.[0]?.message?.content || '');
    if (!valid(q)) throw new Error('OpenAI: invalid structure');
    return { ...q, provider: 'ChatGPT' };
}

async function callClaude(prompt, key) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) throw new Error(`Claude ${r.status}: ${await r.text()}`);
    const d = await r.json();
    const q = parseJSON(d.content?.[0]?.text || '');
    if (!valid(q)) throw new Error('Claude: invalid structure');
    return { ...q, provider: 'Claude' };
}

async function callGroq(prompt, key) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant', max_tokens: 800, temperature: 0.7,
            messages: [{ role: 'system', content: 'أجب بـ JSON فقط بدون نص إضافي.' }, { role: 'user', content: prompt }],
        }),
    });
    if (!r.ok) throw new Error(`Groq ${r.status}: ${await r.text()}`);
    const d = await r.json();
    const q = parseJSON(d.choices?.[0]?.message?.content || '');
    if (!valid(q)) throw new Error('Groq: invalid structure');
    return { ...q, provider: 'Groq' };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
        const { specialty, level, usedTopics } = await req.json();
        const prompt = buildPrompt(specialty || 'طب عام', Number(level) || 1, usedTopics || []);

        const GEMINI    = Deno.env.get('GEMINI_API_KEY')    || '';
        const OPENAI    = Deno.env.get('OPENAI_API_KEY')    || '';
        const ANTHROPIC = Deno.env.get('ANTHROPIC_API_KEY') || '';
        const GROQ      = Deno.env.get('GROQ_API_KEY')      || '';

        const chain = [
            GEMINI    && { name: 'Gemini',  fn: () => callGemini(prompt,  GEMINI)    },
            OPENAI    && { name: 'ChatGPT', fn: () => callOpenAI(prompt,  OPENAI)    },
            ANTHROPIC && { name: 'Claude',  fn: () => callClaude(prompt,  ANTHROPIC) },
            GROQ      && { name: 'Groq',    fn: () => callGroq(prompt,    GROQ)      },
        ].filter(Boolean);

        if (chain.length === 0) {
            return new Response(JSON.stringify({ error: 'لا يوجد API key. أضف على الأقل واحداً.' }),
                { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }

        const errors = [];
        for (const p of chain) {
            try {
                console.log(`Trying ${p.name}...`);
                const result = await p.fn();
                console.log(`✅ ${p.name} succeeded`);
                return new Response(JSON.stringify(result),
                    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
            } catch (e) {
                console.warn(`❌ ${p.name} failed: ${e}`);
                errors.push(`${p.name}: ${e}`);
            }
        }

        return new Response(JSON.stringify({ error: 'جميع المحركات فشلت', details: errors }),
            { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });

    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
});
