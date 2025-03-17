import 'dotenv/config';
import { getTools, type ToolBase } from '@goat-sdk/core';
import { dexscreener } from '@goat-sdk/plugin-dexscreener';
import { jupiter } from '@goat-sdk/plugin-jupiter';
import { Agent, type Capability } from '@openserv-labs/sdk';
import { z } from 'zod';
import { Connection, Keypair } from '@solana/web3.js';
import { solana } from '@goat-sdk/wallet-solana';
import { createWalletClient, http } from 'viem';
import { mainnet } from 'viem/chains';
import { viem } from '@goat-sdk/wallet-viem';
import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}
if (!process.env.OPENSERV_API_KEY) {
  throw new Error('OPENSERV_API_KEY is not set');
}
if (!process.env.RPC_PROVIDER_URL) {
  throw new Error('RPC_PROVIDER_URL is not set');
}

const isDevnet = process.env.RPC_PROVIDER_URL?.includes('devnet');
console.log(`Using ${isDevnet ? 'Devnet' : 'Mainnet'} configuration`);

const systemPrompt = `
You are a cryptocurrency assistant with access to DexScreener and Jupiter (on Solana). You can:

User will give you prompts like What's the quote to swap 1 orca to lifinity or can you swap 1 orca to lifinity , your first step is to use dexscanner to find the token address of the token (using name and solana chain as pair)  , after finding the token address you can use Jupiter APIs to get swap and quote since they only accept address as input not names.

your priority is to get the token address using dexscreener for both the tokens and then getting the swap and quote

to get token address , make a pair of token name with SOL , do this for both 
`;

const toolNameMap = new Map();

const combinedAgent = new Agent({
  systemPrompt,
  apiKey: process.env.OPENSERV_API_KEY,
});

const formatToolName = (name) => name.replace(/\./g, '_');

const toCapability = (tool: ToolBase, toolType: 'dexscreener' | 'jupiter') => {
  const functionName = tool.name.split('.').pop() || tool.name;
  const nameMap: Record<string, string> = {
    'get_quote': 'get_quote',
    'quote': 'get_quote',
    'swapTokens': 'swap',
    'swap': 'swap',
  };

  let baseName = functionName || tool.name;
  if (toolType === 'jupiter') {
    baseName = nameMap[baseName] || baseName;
  }
  const formattedName = formatToolName(baseName);
  toolNameMap.set(formattedName, tool);

  return {
    name: formattedName,
    description: tool.description,
    schema: tool.parameters,
    async run({ args }) {
      if (toolType === 'jupiter' && formattedName === 'swap' && !('userPublicKey' in args)) {
        return "Error: Missing userPublicKey for swap operation.";
      }

      try {
        const originalTool = toolNameMap.get(formattedName);
        if (!originalTool) {
          throw new Error(`Original tool not found for ${formattedName}`);
        }

        const response = await originalTool.execute(args);
        return typeof response === 'object' ? JSON.stringify(response, null, 2) : response.toString();
      } catch (error) {
        console.error(`Error in capability ${formattedName}:`, error);
        return `An error occurred while running ${formattedName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  } as Capability<typeof tool.parameters>;
};

async function main() {
  const connection = new Connection(process.env.RPC_PROVIDER_URL!, 'confirmed');
  console.log(`Connected to Solana RPC: ${process.env.RPC_PROVIDER_URL}`);
  const dummyKeypair = Keypair.generate();
  const dummySolanaWalletClient = {
    publicKey: dummyKeypair.publicKey,
    signTransaction: async (tx) => {
      console.warn("Dummy wallet: signTransaction called. This wallet cannot sign.");
      return tx;
    },
    signAllTransactions: async (txs) => {
      console.warn("Dummy wallet: signAllTransactions called. This wallet cannot sign.");
      return txs;
    },
  };
  const solanaWallet = solana(dummySolanaWalletClient, connection);

  const dummyViemWalletClient = createWalletClient({
    chain: mainnet,
    transport: http(process.env.RPC_PROVIDER_URL),
  });
  const viemWallet = viem(dummyViemWalletClient);

  const jupiterPlugin = jupiter({
    network: isDevnet ? 'devnet' : 'mainnet-beta',
  });
  const dexscreenerPlugin = dexscreener();

  const allTools = await getTools({
    wallet: solanaWallet,
    plugins: [jupiterPlugin, dexscreenerPlugin],
  });

  const jupiterTools = allTools.filter(tool =>
    tool.name.toLowerCase().includes('jupiter') ||
    tool.name.toLowerCase().includes('quote') ||
    tool.name.toLowerCase().includes('swap')
  );
  const dexscreenerTools = allTools.filter(tool => tool.name.startsWith('dexscreener'));
  const filteredDexscreenerTools = dexscreenerTools.filter(tool => tool.name === 'dexscreener.search_pairs');

  const jupiterCapabilities = jupiterTools.map(tool => toCapability(tool, 'jupiter'));
  const dexscreenerCapabilities = filteredDexscreenerTools.map(tool => toCapability(tool, 'dexscreener'));
  const allCapabilities = [...jupiterCapabilities, ...dexscreenerCapabilities];

  try {
    await combinedAgent.addCapabilities(allCapabilities as [
      Capability<z.ZodTypeAny>,
      ...Capability<z.ZodTypeAny>[]
    ]);

    const originalCreateChatCompletion = combinedAgent.openai.chat.completions.create.bind(combinedAgent.openai.chat.completions);
    combinedAgent.openai.chat.completions.create = async function (
        ...args: Parameters<typeof originalCreateChatCompletion>
    ): ReturnType<typeof originalCreateChatCompletion> {
        const [body, ...rest] = args;
        if (body && 'tools' in body) {
            console.log("--- OpenAI Request (Tools): ---");
            console.log(JSON.stringify(body.tools, null, 2));
        }
        return originalCreateChatCompletion(...args);
    } as typeof originalCreateChatCompletion;

    const exampleQueries = [
      "What's the quote to swap 1 jupiter to trump official?",  // Should use Dexscreener to find addresses, then Jupiter
    ];

    for (const query of exampleQueries) {
      console.log(`\nProcessing user query: ${query}`);
      const response = await combinedAgent.process({
        messages: [{ role: 'user', content: query }],
      });
      console.log("Agent Response:", response.choices[0].message.content);
    }
  } catch (error) {
    console.error("Error during processing:", error);
  }
}

combinedAgent.start();
main();
