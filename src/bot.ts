import { Bot, Context } from "grammy";
import axios from "axios";
import { Bip39MnemonicValidator, Bip39SeedGenerator, Bip44, Bip44Coins, Bip44Changes, Bip39Languages } from "bip-utils";
require('dotenv').config();

const bot = new Bot(process.env.TELEGRAM_TOKEN as string);

const networks: Record<string, any> = {
  "ETH": Bip44Coins.ETHEREUM,
  "BTC": Bip44Coins.BITCOIN,
};

bot.command('start', (ctx) => ctx.reply('Welcome!'));
bot.command('help', (ctx) => ctx.reply('Help message'));

bot.on('message', async (ctx: Context) => {
  const seedPhrase: string = ctx.update.message?.text || '';
  let totalBalance = 0;
  let addressWithBalance: string | null = null;
  let derivPaths: [number, number, number][] = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0]];

  // Validate the mnemonic
  const mnemonicValidator = new Bip39MnemonicValidator(Bip39Languages.ENGLISH);
  if (!mnemonicValidator.isValid(seedPhrase)) {
    ctx.reply("Invalid mnemonic");
    return;
  }

  for (let networkKey in networks) {
    for (let derivPath of derivPaths) {
      const address = new Bip44(networks[networkKey], Bip44Changes.EXTERNAL, derivPath[0], derivPath[1], derivPath[2]).deriveAddress(seedPhrase, Bip39Languages.ENGLISH);
      const apiUrl = `https://pro-openapi.debank.com/v1/user/total_balance?id=${address}`;

      try {
        const response = await axios.get(apiUrl);
        const data = response.data;
        if (data.error_code === 0 && data.data[networkKey].total_usd_value > 0) {
          totalBalance += data.data[networkKey].total_usd_value;
          if (!addressWithBalance) addressWithBalance = address;
        }
      } catch (error) {
        console.error(error);
        // Handle this error in a way that suits your needs
      }
    }
  }

  if (addressWithBalance) {
    ctx.reply(`Total Balance: ${totalBalance}, Address: ${addressWithBalance}`);
  } else {
    ctx.reply("No balance found for this seed phrase.");
  }
});

bot.catch((err: any, ctx: Context) => {
  console.error(`Failed to process update ${ctx.update.update_id}:`);
  console.error(err);
});

bot.start();
