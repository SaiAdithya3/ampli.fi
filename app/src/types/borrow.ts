export interface BorrowOffer {
  id: string;
  providerName: string;
  providerLogoUrl: string;
  netApy: string;
  maxLtv: string;
  liquidationPrice: string;
  collateralSymbol: string;
  collateralLogoUrl: string;
  loanSymbol: string;
  loanLogoUrl: string;
  bestOffer: boolean;
}
