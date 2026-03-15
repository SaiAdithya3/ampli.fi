export const WALLET_CONFIG = {
  OKX: {
    id: "okx",
    name: "OKX Wallet",
    icon: "https://ik.imagekit.io/thecirclecompany/wallets/okx.svg",
  },
  Unisat: {
    id: "unisat",
    name: "UniSat",
    icon: "https://ik.imagekit.io/thecirclecompany/wallets/unisat.svg",
  },
  Xverse: {
    id: "xverse",
    name: "Xverse",
    icon: "https://ik.imagekit.io/thecirclecompany/wallets/xverse.svg",
  },
  Phantom: {
    id: "phantom",
    name: "Phantom",
    icon: "https://ik.imagekit.io/thecirclecompany/wallets/phantomDark.svg",
  },
  Keplr: {
    id: "keplr",
    name: "Keplr",
    icon: "https://ik.imagekit.io/thecirclecompany/wallets/keplr.svg",
  },
} as const;

export type BitcoinWalletId = (typeof WALLET_CONFIG)[keyof typeof WALLET_CONFIG]["id"];
