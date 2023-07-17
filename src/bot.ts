import { Bot, Context } from 'grammy';
import axios from 'axios';
import { Bip44, Bip44Coins, Bip39Languages, Bip39SeedGenerator, Bip39MnemonicValidator, Bip44Changes } from 'bip-utils';
import 'dotenv/config';

const bot = new Bot(process.env.API_KEY);

async function deriveAddress(mnemonic, coinType, accountIndex, change, addressIndex) {
  try {
    new Bip39MnemonicValidator(Bip39Languages.ENGLISH).Validate(mnemonic);
    const seedBytes = new Bip39SeedGenerator(mnemonic).Generate();
    const bipObjMst = Bip44.FromSeed(seedBytes, coinType);
    const address = bipObjMst.Purpose().Coin().Account(accountIndex).Change(
      change === 0 ? Bip44Changes.CHAIN_EXT : Bip44Changes.CHAIN_INT
    ).AddressIndex(addressIndex).PublicKey().ToAddress();
    return address;
  } catch (err) {
    return `Error: ${err}`;
  }
}

async function getBalance(address, coinType) {
  let apiUrl = '';
  let headers = {};
  if (coinType === 'BTC') {
    apiUrl = `https://api.blockchair.com/bitcoin/dashboards/address/${address}`;
  } else {
    apiUrl = `https://pro-openapi.debank.com/v1/user/total_balance?id=${address}`;
    headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36',
      'AccessKey': process.env.ACCESS_KEY_DEBANK, // add your AccessKey to the .env file as ACCESS_KEY_DEBANK=your_access_key
    };
  }
  try {
    const response = await axios.get(apiUrl, { headers });
    if (response.status === 200) {
      return response.data;
    }
  } catch (err) {
    return `Error: ${err}`;
  }
}

bot.command('balance', async (ctx) => {
  const networks = {
    ETH: Bip44Coins.ETHEREUM,
    BTC: Bip44Coins.BITCOIN,
  };
  const derivPaths = [[0, 0, 0], [0, 0, 1], [0, 1, 0], [0, 1, 1], [1, 0, 0]];
  for (const network in networks) {
    if (networks.hasOwnProperty(network)) {
      const coinType = networks[network];
      for (const path of derivPaths) {
        const address = await deriveAddress(ctx.message.text, coinType, ...path);
        if (address.startsWith('Error')) {
          await ctx.reply(address);
          return;
        }
        const balance = await getBalance(address, coinType);
        if (balance > 0) {
          await ctx.reply(`Address: ${address}\nNetwork: ${network}\nBalance: ${balance}`);
          return;
        }
      }
    }
  }
  await ctx.reply('No balance found');
});

bot.start((ctx) => ctx.reply('Welcome! Send me your mnemonic to check your balance.'));

bot.catch((err: any, ctx: Context) => {
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  console.error(err);
});

// Setting the webhook directly from code
(async () => {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${process.env.API_KEY}/setWebhook`,
      {
        url: process.env.TELEGRAM_WEBHOOK_URL,
      }
    );

    if (response.data.ok) {
      console.log("Webhook has been set successfully.");
    } else {
      console.log("Failed to set the webhook: ", response.data.description);
    }
  } catch (error) {
    console.log("Error setting the webhook: ", error.message);
  }
})();

bot.start();
