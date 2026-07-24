const API_URL = process.env.BUILT_IN_FORGE_API_URL;
const API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

export async function invokeLLM(prompt: string): Promise<string> {
  if (!API_URL || !API_KEY) {
    throw new Error("BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY environment variables are required");
  }

  const response = await fetch(`${API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM response contained no content");
  }
  return content;
}
