'use client';

import { PropsWithChildren, useState } from "react";
import { PhantomContext, TDappKeyPair } from "./context";

export function PhantomProvider(props:PropsWithChildren) {
    const [address, setAddress] = useState<string>('');
    const [phantomPublicKey, setPhantomPublicKey] = useState<string>('');
    const [sharedSecret, setSharedSecret] = useState<string>('');
    const [dappKeyPair, setDappKeyPair] = useState<TDappKeyPair>({publicKey: new Uint32Array(0), secretKey: new Uint32Array(0)});


  return <PhantomContext.Provider value={{
    address,
    phantomPublicKey,
    sharedSecret,
    dappKeyPair,
  }}>
    {props.children}
  </PhantomContext.Provider>;
};