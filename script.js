export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const body = await request.json();
      const provider = body.provider || "deepseek";
      const messages = body.messages;

      let apiUrl, apiKey, model, requestBody;

      if (provider === "groq") {
        apiUrl = "https://api.groq.com/openai/v1/chat/completions";
        apiKey = env.GROQ_API_KEY;
        model = body.model || "llama-3.3-70b-versatile";
        requestBody = {
          model: model,
          messages: messages,
          stream: false,
        };
      } else if (provider === "openrouter") {
        apiUrl = "https://openrouter.ai/api/v1/chat/completions";
        apiKey = env.OPENROUTER_API_KEY;
        model = body.model || "openrouter/free";
        requestBody = {
          model: model,
          messages: messages,
          stream: false,
          max_tokens: 2048, // Ограничение стоимости для избежания ложных 402
        };
      } else {
        apiUrl = "https://api.deepseek.com/chat/completions";
        apiKey = env.DEEPSEEK_API_KEY;
        model = body.model || "deepseek-chat";
        requestBody = {
          model: model,
          messages: messages,
          stream: false,
        };
      }

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ error: errorText }), {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Proxy error: " + error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
