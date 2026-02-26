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

このお題に関する代表的な答えを、できるだけ網羅的にJSON形式の配列で生成してください。
「世界のすべての国」「日本の都道府県」など全体の数が決まっているものは可能な限りすべて挙げてください。
JSONの厳密なフォーマット:
{
  "title": "生成された美しいタイトル(例: アレルギーの種類)",
  "notes": "プレイヤーへの注意事項やヒント(例: 「〜アレルギー」の「アレルギー」部分は省略して入力できます)",
  "answers": [
    ["表示名1(例: そばアレルギー)", "ひらがな入力1(例: そばあれるぎー)", "別解A", "別解B"],
    ["表示名2(例: 小麦アレルギー)", "ひらがな入力2(例: こむぎあれるぎー)", "別解A"]
  ]
}

制約事項:
- 答えの内容は正確であること。
- answers配列の各要素は配列であり、[表示名, ひらがな入力, 別解...] の順にしてください。
- 最初の2つ（表示名, ひらがな入力）は必須です。
- 別解（3つ目以降の要素）について非常に重要なルール：
  1. ユーザーが入力しやすくするため、**共通する語尾や語彙を省略した形を必ず別解に含めてください。**
     例: 「そばアレルギー」の場合は、別解に「そば」を含める。
     例: 「アメリカ合衆国」の場合は、別解に「あめりか」「アメリカ」を含める。
     例: 「青森県」の場合は、別解に「あおもり」「青森」を含める。
  2. 同じ意味の違う言葉（リンゴとアップルなど）も別解に含めてください。
  3. 別解要素はいくつあっても構いません（無い場合は要素なしでOK）。
- 最後の要素のケツカンマ（trailing comma）は絶対に書かないでください。JSONとしてパースできなくなります。
- 出力が途中で途切れるとエラーになるため、配列は必ず ] と } で完全に閉じて完了させてください。
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

            // Auto-retry on rate limit (429)
            if (response.status === 429) {
                throw new Error('APIの利用制限に達しました。20秒後にもう一度お試しください。');
            }
            throw new Error(`Gemini API Error (${response.status}): ${errorData}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidate) {
            throw new Error('Gemini APIから有効なテキストが返ってきませんでした');
        }

        // Clean up markdown block if the model ignores the instruction
        let jsonString = candidate.replace(/^```json/g, '').replace(/```$/g, '').trim();

        // Final fallback: if the string ends abruptly before closing tags, try to soft-close it (rudimentary)
        if (!jsonString.endsWith('}')) {
            // Remove trailing commas if any, then close arrays/objects
            jsonString = jsonString.replace(/,\s*$/g, '');
            if (jsonString.lastIndexOf(']') > jsonString.lastIndexOf('[')) {
                jsonString += "\n]}";
            } else {
                jsonString += "]}"; // desperate attempt
            }
        }

        let parsedData;
        try {
            parsedData = JSON.parse(jsonString);
        } catch (parseError) {
            console.error("JSON Parse Error on string:", jsonString);
            throw new Error('AIが返した回答の形式が崩れていました（JSONパースエラー）。もう一度お試しください。');
        }

        return res.status(200).json(parsedData);
    } catch (error) {
        console.error('Generation server error:', error);
        return res.status(500).json({ error: error.message || 'お題の生成中にエラーが発生しました' });
    }
}
