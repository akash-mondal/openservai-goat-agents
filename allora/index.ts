import 'dotenv/config';

import { getTools, type ToolBase } from '@goat-sdk/core';
import { allora } from '@goat-sdk/plugin-allora';
import { Agent, type Capability } from '@openserv-labs/sdk';
import { createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { viem } from '@goat-sdk/wallet-viem';
import { z } from 'zod';

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
}

if (!process.env.OPENSERV_API_KEY) {
    throw new Error('OPENSERV_API_KEY is not set');
}

if (!process.env.RPC_PROVIDER_URL) {
    throw new Error('RPC_PROVIDER_URL is not set');
}

if (!process.env.ALLORA_API_KEY) {
    throw new Error('ALLORA_API_KEY is not set');
}

const systemPrompt = `
You are an AI agent specializing in cryptocurrency price predictions using the Allora Network.
You provide users with predictive insights on cryptocurrency price movements.

Here's how you operate:

1. **Understand the User's Request:** Determine if the user is asking about:
   - Price predictions for Bitcoin (BTC)
   - Price predictions for Ethereum (ETH)
   - Price predictions for different timeframes (5m or 8h)

2. **Use the Correct Tool:** Based on the user's request, use the "get_price_prediction" tool with the appropriate parameters:
   - ticker: The cryptocurrency ticker (BTC or ETH)
   - timeframe: The prediction timeframe (5m or 8h)

3. **Provide Clear and Concise Information:** Present the prediction results from Allora in a user-friendly format.
   - Explain the price prediction in context
   - Include relevant metrics from the prediction data
   - Make the information easily digestible for users of all knowledge levels

4. **Handle Errors Gracefully**: If you encounter an error, say "An error occurred while processing your request. Please check parameters".

Example Interactions:

User: "What's the price prediction for Bitcoin in the next 5 minutes?"
You: (Use the "get_price_prediction" tool with ticker="BTC" and timeframe="5m" and present the results)

User: "Can you predict Ethereum's price in the next 8 hours?"
You: (Use the "get_price_prediction" tool with ticker="ETH" and timeframe="8h" and present the results)
`;

const goatAgent = new Agent({
    systemPrompt,
});

const toCapability = (tool: ToolBase) => {
    console.log(`Converting tool to capability: ${tool.name}`);
    
    // Extract the actual function name from the tool name (remove any prefixes)
    // This assumes that tool names are in the format "namespace.function_name"
    const functionName = tool.name.split('.').pop() || tool.name;
    
    // Create explicit mapping for all possible tool names
    const nameMap: Record<string, string> = {
        'get_price_prediction': 'get_price_prediction',
        'price_prediction': 'get_price_prediction',
        // Add any other name variations that might exist
    };

    // Use the extracted function name or the original tool name
    const baseName = functionName || tool.name;
    const capabilityName = nameMap[baseName] || baseName;
    
    console.log(`Mapped tool name: ${tool.name} -> ${capabilityName}`);
    console.log(`Tool parameters schema:`, tool.parameters);
    
    return {
        name: capabilityName,
        description: tool.description,
        schema: tool.parameters,
        async run({ args }) {
            console.log(`Running capability ${capabilityName} with args:`, args);
            try {
                const response = await tool.execute(args);
                console.log(`Tool ${tool.name} response:`, response);
                if (typeof response === 'object') {
                    return JSON.stringify(response, null, 2);
                }
                return response.toString();
            } catch (error) {
                console.error(`Error in capability ${tool.name}:`, error);
                return `An error occurred while running ${tool.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
        },
    } as Capability<typeof tool.parameters>;
};

async function main() {
    console.log("Initializing agent...");
    
    const dummyWalletClient = createWalletClient({
        chain: mainnet,
        transport: http(process.env.RPC_PROVIDER_URL),
    });

    const wallet = viem(dummyWalletClient);
    console.log("Wallet client initialized");

    console.log("Initializing Allora plugin...");
    const alloraPlugin = allora({
        apiKey: process.env.ALLORA_API_KEY, // Get it from: https://allora.network/api-access
    });

    console.log("Getting all tools...");
    const allTools = await getTools({
        wallet,
        plugins: [alloraPlugin],
    });

    console.log("All available tools:", allTools.map(tool => tool.name));

    // Try different filter strategies to find the right tools
    const alloraTools = allTools.filter(tool => 
        tool.name.toLowerCase().includes('allora') || 
        tool.name.toLowerCase().includes('price') || 
        tool.name.toLowerCase().includes('prediction')
    );
    
    console.log("Filtered Allora tools:", alloraTools.map(tool => tool.name));

    if (alloraTools.length === 0) {
        console.error("No Allora tools found! Check plugin initialization and naming conventions.");
        
        // As a fallback, let's see what tools are actually available
        console.log("Available tool categories:", new Set(allTools.map(tool => {
            const parts = tool.name.split('.');
            return parts.length > 1 ? parts[0] : 'uncategorized';
        })));
        
        return;
    }

    const capabilities = alloraTools.map(toCapability);
    console.log("Capabilities created:", capabilities.map(cap => cap.name));

    try {
        console.log("Adding capabilities to agent...");
        await goatAgent.addCapabilities(capabilities as [
            Capability<z.ZodTypeAny>,
            ...Capability<z.ZodTypeAny>[]
        ]);
        console.log("Starting agent...");
        await goatAgent.start();
        console.log("Agent started successfully");
    } catch (error) {
        console.error("Error starting agent:", error);
        return;
    }
    
    try {
        console.log("Processing user query...");
        const response = await goatAgent.process({
            messages: [
                {
                    role: 'user',
                    content: "What's the price prediction for btc in the next 8 hours vs next 5mins?",
                },
            ],
        });
        console.log("Agent Response:", response.choices[0].message.content);
    } catch (error) {
        console.error("Error processing query:", error);
    }
}
main().catch(error => {
    console.error("Unhandled error in main function:", error);
    process.exit(1);
});
