"use client";
// pages/index.tsx
import { useEffect, useRef, useState, useCallback } from "react";

import { Buffer } from "buffer";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

global.Buffer = global.Buffer || Buffer;

const NETWORK = clusterApiUrl("mainnet-beta");

const buildUrl = (path: string, params: URLSearchParams) =>
  `https://phantom.app/ul/v1/${path}?${params.toString()}`;

const decryptPayload = (
  data: string,
  nonce: string,
  sharedSecret?: Uint8Array
) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const decryptedData = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  if (!decryptedData) {
    throw new Error("Unable to decrypt data");
  }
  return JSON.parse(Buffer.from(decryptedData).toString("utf8"));
};

const encryptPayload = (payload: any, sharedSecret?: Uint8Array) => {
  if (!sharedSecret) throw new Error("missing shared secret");

  const nonce = nacl.randomBytes(24);

  const encryptedPayload = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret
  );

  return [nonce, encryptedPayload];
};

const Home = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const connection = new Connection(NETWORK);
  const addLog = useCallback(
    (log: string) => setLogs((logs) => [...logs, "> " + log]),
    []
  );
  const scrollViewRef = useRef<HTMLDivElement>(null);

  // store dappKeyPair, sharedSecret, session and account SECURELY on device
  // to avoid having to reconnect users.
  const [dappKeyPair] = useState(nacl.box.keyPair());
  const [sharedSecret, setSharedSecret] = useState<Uint8Array>();
  const [session, setSession] = useState<string>();
  const [phantomWalletPublicKey, setPhantomWalletPublicKey] =
    useState<PublicKey>();

  useEffect(() => {
    const initialUrl = window.location.href;
    setDeepLink(initialUrl);
  }, []);

  const setDeepLink = (url: string) => {
    handleDeepLink(url);
  };

  const handleDeepLink = (url: string) => {
    const params = new URL(url).searchParams;

    if (params.get("errorCode")) {
      addLog(JSON.stringify(Object.fromEntries([...params]), null, 2));
      return;
    }

    if (/onConnect/.test(url)) {
      const sharedSecretDapp = nacl.box.before(
        bs58.decode(params.get("phantom_encryption_public_key")!),
        dappKeyPair.secretKey
      );

      const connectData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecretDapp
      );

      setSharedSecret(sharedSecretDapp);
      setSession(connectData.session);
      setPhantomWalletPublicKey(new PublicKey(connectData.public_key));

      addLog(JSON.stringify(connectData, null, 2));
    } else if (/onDisconnect/.test(url)) {
      addLog("Disconnected!");
    } else if (/onSignAndSendTransaction/.test(url)) {
      const signAndSendTransactionData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      addLog(JSON.stringify(signAndSendTransactionData, null, 2));
    } else if (/onSignAllTransactions/.test(url)) {
      const signAllTransactionsData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      const decodedTransactions = signAllTransactionsData.transactions.map(
        (t: string) => Transaction.from(bs58.decode(t))
      );

      addLog(JSON.stringify(decodedTransactions, null, 2));
    } else if (/onSignTransaction/.test(url)) {
      const signTransactionData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      const decodedTransaction = Transaction.from(
        bs58.decode(signTransactionData.transaction)
      );

      addLog(JSON.stringify(decodedTransaction, null, 2));
    } else if (/onSignMessage/.test(url)) {
      const signMessageData = decryptPayload(
        params.get("data")!,
        params.get("nonce")!,
        sharedSecret
      );

      addLog(JSON.stringify(signMessageData, null, 2));
    }
  };

  const createTransferTransaction = async () => {
    if (!phantomWalletPublicKey)
      throw new Error("missing public key from user");
    let transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: phantomWalletPublicKey,
        toPubkey: phantomWalletPublicKey,
        lamports: 100,
      })
    );
    transaction.feePayer = phantomWalletPublicKey;
    addLog("Getting recent blockhash");
    const anyTransaction: any = transaction;
    anyTransaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    return transaction;
  };

  const connect = async () => {
    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      cluster: "mainnet-beta",
      app_url: "https://phantom.app",
      redirect_link: window.location.href,
    });

    const url = buildUrl("connect", params);
    window.location.href = url;
  };

  const disconnect = async () => {
    const payload = {
      session,
    };
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: window.location.href,
      payload: bs58.encode(encryptedPayload),
    });

    const url = buildUrl("disconnect", params);
    window.location.href = url;
  };

  const signAndSendTransaction = async () => {
    const transaction = await createTransferTransaction();

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    });

    const payload = {
      session,
      transaction: bs58.encode(serializedTransaction),
    };
    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: window.location.href,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Sending transaction...");
    const url = buildUrl("signAndSendTransaction", params);
    window.location.href = url;
  };

  const signAllTransactions = async () => {
    const transactions = await Promise.all([
      createTransferTransaction(),
      createTransferTransaction(),
    ]);

    const serializedTransactions = transactions.map((t) =>
      bs58.encode(
        t.serialize({
          requireAllSignatures: false,
        })
      )
    );

    const payload = {
      session,
      transactions: serializedTransactions,
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: window.location.href,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Signing transactions...");
    const url = buildUrl("signAllTransactions", params);
    window.location.href = url;
  };

  const signTransaction = async () => {
    const transaction = await createTransferTransaction();

    const serializedTransaction = bs58.encode(
      transaction.serialize({
        requireAllSignatures: false,
      })
    );

    const payload = {
      session,
      transaction: serializedTransaction,
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: window.location.href,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Signing transaction...");
    const url = buildUrl("signTransaction", params);
    window.location.href = url;
  };

  const signMessage = async () => {
    const message =
      "To avoid digital dognappers, sign below to authenticate with CryptoCorgis.";

    const payload = {
      session,
      message: bs58.encode(Buffer.from(message)),
    };

    const [nonce, encryptedPayload] = encryptPayload(payload, sharedSecret);

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(dappKeyPair.publicKey),
      nonce: bs58.encode(nonce),
      redirect_link: window.location.href,
      payload: bs58.encode(encryptedPayload),
    });

    addLog("Signing message...");
    const url = buildUrl("signMessage", params);
    window.location.href = url;
  };

  return (
    <div
      style={{
        backgroundColor: "#333",
        minHeight: "100vh",
        color: "#fff",
        padding: "20px",
      }}
    >
      <div
        ref={scrollViewRef}
        style={{ maxHeight: "80vh", overflowY: "auto", marginBottom: "20px" }}
      >
        {logs.map((log, i) => (
          <pre key={i} style={{ fontFamily: "monospace", fontSize: "14px" }}>
            {log}
          </pre>
        ))}
      </div>
      <div>
        <button onClick={connect} style={buttonStyle}>
          Connect
        </button>
        <button onClick={disconnect} style={buttonStyle}>
          Disconnect
        </button>
        <button onClick={signAndSendTransaction} style={buttonStyle}>
          Sign And Send Transaction
        </button>
        <button onClick={signAllTransactions} style={buttonStyle}>
          Sign All Transactions
        </button>
        <button onClick={signTransaction} style={buttonStyle}>
          Sign Transaction
        </button>
        <button onClick={signMessage} style={buttonStyle}>
          Sign Message
        </button>
      </div>
    </div>
  );
};

const buttonStyle = {
  margin: "10px",
  padding: "10px 20px",
  backgroundColor: "#444",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

export default Home;
