export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'Vercelの環境変数に GEMINI_API_KEY が設定されていません。Google AI StudioでAPIキーを取得し、VercelダッシュボードのEnvironment Variablesに追加してください。'
        });
    }

    const systemPrompt = `あなたはクイズゲーム「言えるかな？ゲーム」のお題自動作成AIです。
ユーザーからのお題リクエスト: 「${prompt}」

このお題に関する代表的な答えを、できるだけ網羅的に（最大100個程度まで）JSON形式の配列で生成してください。
「世界のすべての国」「日本の都道府県」など全体の数が決まっているものは可能な限りすべて挙げてください。
JSONの厳密なフォーマット:
{
  "title": "生成された美しいタイトル(例: 歴代の総理大臣)",
  "answers": [
    ["表示名1(例: 伊藤博文)", "ひらがな入力1(例: いとうひろぶみ)", "別解A", "別解B"],
    ["表示名2(例: 黒田清隆)", "ひらがな入力2(例: くろだきよたか)", "別解A"]
  ]
}

制約事項:
- 答えの内容は正確であること。
- answers配列の各要素は配列であり、[表示名, ひらがな入力, 別解...] の順にしてください。
- 最初の2つ（表示名, ひらがな入力）は必須です。別解は任意ですが、揺れがある場合（例: リンゴ, アップル など）は追加してください。
- 出力は純粋なJSON文字列のみを行ってください。マークダウンの \`\`\`json などの修飾は絶対に含めないでください。波括弧 {} で始まり波括弧で終わる必要があります。`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error('Gemini API Error:', errorData);
            throw new Error(`Gemini API Error (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidate) {
            throw new Error('Gemini APIから有効なテキストが返ってきませんでした');
        }

        // Clean up markdown block if the model ignores the instruction
        const jsonString = candidate.replace(/^```json/g, '').replace(/```$/g, '').trim();
        const parsedData = JSON.parse(jsonString);

        return res.status(200).json(parsedData);
    } catch (error) {
        console.error('Generation server error:', error);
        return res.status(500).json({ error: error.message || 'お題の生成中にエラーが発生しました' });
    }
}
