'use client';

import React from "react";

export type TDappKeyPair = {
    publicKey: Uint32Array;
    secretKey: Uint32Array;
};


export interface IPhantomContext {
    phantomPublicKey: string;
    sharedSecret: string;
    dappKeyPair: TDappKeyPair;
    address:string;
}

export const PhantomContext = React.createContext<IPhantomContext>({} as IPhantomContext);