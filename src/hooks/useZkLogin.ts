// src/hooks/useZkLogin.ts
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import queryString from "query-string";
import { useLocation } from "react-router-dom";
import { useSnackbar } from "notistack";
import { jwtDecode } from "jwt-decode";
import type { JwtPayload } from "jwt-decode";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { useSuiClientQuery } from "@mysten/dapp-kit";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from "@mysten/sui/zklogin";
import { suiClient as mkClient } from "../services/sui";
import { buildGoogleAuthUrl } from "../services/auth";
import type { PartialZkLoginSignature } from "../types/zk";

import {
  CLIENT_ID,
  FULLNODE_URL,
  KEY_PAIR_SESSION_STORAGE_KEY,
  MAX_EPOCH_LOCAL_STORAGE_KEY,
  RANDOMNESS_SESSION_STORAGE_KEY,
  REDIRECT_URI,
  SUI_DEVNET_FAUCET,
  SUI_PROVER_DEV_ENDPOINT,
  USER_SALT_LOCAL_STORAGE_KEY,
} from "../constants";

const client = mkClient(FULLNODE_URL);

export function useZkLogin() {

  const {enqueueSnackbar} = useSnackbar();
  // state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [requestingFaucet, setRequestingFaucet] = useState(false);
  const [ephemeralKeyPair, setEphemeralKeyPair] = useState<Ed25519Keypair>();
  const [maxEpoch, setMaxEpoch] = useState(0);
  const [randomness, setRandomness] = useState("");
  const [nonce, setNonce] = useState("");
  const [userSalt, setUserSalt] = useState<string>();
  const [decodedJwt, setDecodedJwt] = useState<JwtPayload>();
  const [zkLoginUserAddress, setZkLoginUserAddress] = useState("");
  const [zkProof, setZkProof] = useState<PartialZkLoginSignature>();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTx, setPendingTx] = useState<{ address: string; amount: string } | null>(null);

  // oauth
  const location = useLocation();
  const oauthParams = useMemo(() => queryString.parse(location.hash), [location]);

  // navigate 
  const navigate = useNavigate();
  // reset state
  const resetState = () => {
    setIsLoggedIn(false);
    setRedirecting(false);
    setRequestingFaucet(false);
    setEphemeralKeyPair(undefined);
    setMaxEpoch(0);
    setRandomness("");
    setNonce("");
    setUserSalt(undefined);
    setDecodedJwt(undefined);
    setZkLoginUserAddress("");
    setZkProof(undefined);
    setConfirmOpen(false);
    setPendingTx(null);
  }
  const resetLocalState = () => {
    try {
      window.sessionStorage.clear();
      window.localStorage.clear();
      navigate("/");
      resetState();
      enqueueSnackbar("Reset Success", {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(String(error), {
        variant: 'error'
      })
    }
  };

  // persist → restore
  useEffect(() => {
    const sk = window.sessionStorage.getItem(KEY_PAIR_SESSION_STORAGE_KEY);
    if (sk) setEphemeralKeyPair(Ed25519Keypair.fromSecretKey(sk));

    const rand = window.sessionStorage.getItem(RANDOMNESS_SESSION_STORAGE_KEY);
    if (rand) setRandomness(rand);

    const salt = window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY);
    if (salt) setUserSalt(salt);

    const me = window.localStorage.getItem(MAX_EPOCH_LOCAL_STORAGE_KEY);
    if (me) setMaxEpoch(Number(me));
  }, []);

  // decode JWT, set address
  useEffect(() => {
    if (!oauthParams || !oauthParams.id_token) return;
    setIsLoggedIn(true);
    const jwtStr = oauthParams.id_token as string;
    const d = jwtDecode(jwtStr);
    setDecodedJwt(d);
    const salt = window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY) || "0";
    const addr = jwtToAddress(jwtStr, salt);
    setZkLoginUserAddress(addr);
  }, [oauthParams]);

  // fetch zk proof once we have all inputs
  useEffect(() => {
    if (!ephemeralKeyPair || !maxEpoch || !randomness || !userSalt || !oauthParams?.id_token) return;

    const ext = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());

    (async () => {
      try {
        const { data } = await axios.post(
          SUI_PROVER_DEV_ENDPOINT,
          {
            jwt: oauthParams.id_token as string,
            extendedEphemeralPublicKey: ext,
            maxEpoch,
            jwtRandomness: randomness,
            salt: userSalt,
            keyClaimName: "sub",
          },
          { headers: { "Content-Type": "application/json" } }
        );
        setZkProof(data as PartialZkLoginSignature);
        enqueueSnackbar("ZK proof ready", { variant: "success" });
      } catch (e: any) {
        enqueueSnackbar(String(e?.response?.data?.message || e), { variant: "error" });
      }
    })();
  }, [ephemeralKeyPair, maxEpoch, randomness, userSalt, oauthParams]);

  // live balance
  const { data: balance } = useSuiClientQuery(
    "getBalance",
    { owner: zkLoginUserAddress },
    { enabled: Boolean(zkLoginUserAddress), refetchInterval: 1500 }
  );

  // actions
  async function startLogin() {
    setRedirecting(true);

    const kp = Ed25519Keypair.generate();
    setEphemeralKeyPair(kp);
    window.sessionStorage.setItem(KEY_PAIR_SESSION_STORAGE_KEY, kp.getSecretKey());

    const { epoch } = await client.getLatestSuiSystemState();
    const me = Number(epoch) + 10;
    setMaxEpoch(me);
    window.localStorage.setItem(MAX_EPOCH_LOCAL_STORAGE_KEY, String(me));

    const rand = generateRandomness();
    setRandomness(rand);
    window.sessionStorage.setItem(RANDOMNESS_SESSION_STORAGE_KEY, rand);

    const n = generateNonce(kp.getPublicKey(), me, rand);
    setNonce(n);

    // NOTE: use a real salt in production; "0" is demo-only.
    const salt = "0";
    setUserSalt(salt);
    window.localStorage.setItem(USER_SALT_LOCAL_STORAGE_KEY, salt);
    nonce;
    const url = buildGoogleAuthUrl({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      nonce: n,
      scope: "openid",
      responseType: "id_token", 
    });
    window.location.replace(url);
  }

  function signOut() {
    resetLocalState();
  }

  async function faucet(recipient: string) {
    if (!recipient) return;
    try {
      setRequestingFaucet(true);
      await axios.post(SUI_DEVNET_FAUCET, { FixedAmountRequest: { recipient } });
      enqueueSnackbar("Faucet success", { variant: "success" });
    } catch (e) {
      enqueueSnackbar(String(e), { variant: "error" });
    } finally {
      setRequestingFaucet(false);
    }
  }

  return {
    // state
    isLoggedIn,
    redirecting,
    requestingFaucet,
    decodedJwt,
    zkLoginUserAddress,
    balance,
    zkProof,
    ephemeralKeyPair,
    maxEpoch,
    userSalt,
    // tx confirmation dialog
    confirmOpen,
    setConfirmOpen,
    pendingTx,
    setPendingTx,
    // actions
    startLogin,
    signOut,
    faucet,
    // raw bits
    client,
  };
}
