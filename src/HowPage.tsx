import BigNumber from "bignumber.js";
import { Transaction } from "@mysten/sui/transactions"
import axios from "axios";
import { enqueueSnackbar } from "notistack";
import GoogleLogo from "./assets/GoogleLogo.svg";
import {
  MIST_PER_SUI,
} from "@mysten/sui/utils";

import queryString from "query-string";
import { useLocation, useNavigate } from "react-router-dom";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  getZkLoginSignature,
  genAddressSeed
} from '@mysten/sui/zklogin';
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  CLIENT_ID,
  FULLNODE_URL,
  KEY_PAIR_SESSION_STORAGE_KEY,
  MAX_EPOCH_LOCAL_STORAGE_KEY,
  RANDOMNESS_SESSION_STORAGE_KEY,
  REDIRECT_URI,
  STEPS_LABELS,
  SUI_DEVNET_FAUCET,
  SUI_PROVER_DEV_ENDPOINT,
  USER_SALT_LOCAL_STORAGE_KEY,
} from "./constants";

import { toBase64 } from "@mysten/sui/utils";
import { type JwtPayload, jwtDecode } from "jwt-decode";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { SuiClient } from '@mysten/sui/client';
import { useSuiClientQuery } from "@mysten/dapp-kit";
import { useState, useMemo, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>["0"]["inputs"],
  "addressSeed"
>;


const suiClient = new SuiClient({ url: FULLNODE_URL });



function HowItWorksPage() {
  const [executeDigest, setExecuteDigest] = useState("")
  const [ephemeralKeyPair, setEphemeralKeyPair] = useState<Ed25519Keypair>();
  const [activeStep, setActiveStep] = useState(0);
  const [maxEpoch, setMaxEpoch] = useState(0);
  const [CurrentEpoch, setCurrentEpoch] = useState("");
  const [userSalt, setUserSalt] = useState<string>();
  const [randomness, setRandomness] = useState("");
  const [nonce, setNonce] = useState("");
  const [decodedJwt, setDecodedJwt] = useState<JwtPayload>();
  const [oauthParams, setOauthParams] = useState<queryString.ParsedQuery<string>>();
  const [jwtString, setJwtString] = useState("");
  const [zkLoginUserAddress, setZkLoginUserAddress] = useState("");
  const [extendedEphemeralPublicKey, setExtendedEphemeralPublicKey] = useState("");
  const [fetchingZKProof, setFetchingZKProof] = useState(false);
  const [zkProof, setZkProof] = useState<PartialZkLoginSignature>();
  const [executingTxn, setExecutingTxn] = useState(false);
  const [requestingFaucet, setRequestingFaucet] = useState(false);



  const location = useLocation();
  const navigate = useNavigate();

  const resetState = () => {
    setCurrentEpoch("");
    setNonce("");
    setOauthParams(undefined);
    setZkLoginUserAddress("");
    setDecodedJwt(undefined);
    setJwtString("");
    setEphemeralKeyPair(undefined);
    setUserSalt(undefined);
    setZkProof(undefined);
    setExtendedEphemeralPublicKey("");
    setMaxEpoch(0);
    setRandomness("");
    setActiveStep(0);
    setFetchingZKProof(false);
    setExecutingTxn(false);
    setExecuteDigest("");
  };

  const resetLocalState = () => {
    try {
      window.sessionStorage.clear();
      window.localStorage.clear();
      resetState();
      navigate(`/how`);
      setActiveStep(0);
      enqueueSnackbar("Reset Success", {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(String(error), {
        variant: 'error'
      })
    }
  };

  /* run this effect everytime location changes */
  /* location.hash is the URL fragment containing the OAuth parameters when the user is redirected back from the Google login page */
  useEffect(() => {
    const res = queryString.parse(location.hash);
    setOauthParams(res);
  }, [location]);

  /* If oauthParams is set, decode the JWT, set the jwtString  with the id_token, set the DecodedJwt and move to step 2 */
  useEffect(() => {
    if (oauthParams && oauthParams.id_token) {
      const decodedJwt = jwtDecode(oauthParams.id_token as string);
      setJwtString(oauthParams.id_token as string);
      setDecodedJwt(decodedJwt);
      setActiveStep(2);
    }
  }, [oauthParams]);

  /* persist after reload */
  useEffect(() => {
    const privateKey = window.sessionStorage.getItem(
      KEY_PAIR_SESSION_STORAGE_KEY
    );
    if (privateKey) {
      const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
        privateKey
      );
      setEphemeralKeyPair(ephemeralKeyPair);
    }
    const randomness = window.sessionStorage.getItem(
      RANDOMNESS_SESSION_STORAGE_KEY
    );
    if (randomness) {
      setRandomness(randomness);
    }
    const userSalt = window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY);
    if (userSalt) {
      setUserSalt(userSalt);
    }

    const maxEpoch = window.localStorage.getItem(MAX_EPOCH_LOCAL_STORAGE_KEY);

    if (maxEpoch) {
      setMaxEpoch(Number(maxEpoch));
    }
  }, []);



  const requestFaucet = async () => {
    if (!zkLoginUserAddress) {
      return;
    }
    try {
      setRequestingFaucet(true);
      await axios.post(SUI_DEVNET_FAUCET, {
        FixedAmountRequest: {
          recipient: zkLoginUserAddress,
        },
      });
      enqueueSnackbar("Success!", {
        variant: "success",
      });
    } catch (error) {
      enqueueSnackbar(String(error), {
        variant: "error",
      });
    } finally {
      setRequestingFaucet(false);
    }
  };


  const { data: addressBalance } = useSuiClientQuery(
    "getBalance",
    {
      owner: zkLoginUserAddress,
    },
    {
      enabled: Boolean(zkLoginUserAddress),
      refetchInterval: 1500,
    }
  );




  /* TODO */
  const nextButtonIsDisabled = useMemo(() => {
    switch (activeStep) {
      case 0:
        return !ephemeralKeyPair;
      case 1:
        return !CurrentEpoch || !randomness;
      case 2:
        return !jwtString;
      case 3:
        return !userSalt;
      case 4:
        return !zkLoginUserAddress
      default:
        return false;

    }
  }, [
    activeStep,
    ephemeralKeyPair,
    CurrentEpoch,
    randomness,
    jwtString,
    userSalt,
    zkLoginUserAddress
  ]);


  return (
    <Box sx={{ mb: "30px" }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          zkLogin
        </Typography>
      </Box>

      <Box
        sx={{
          width: "100%",
          overflowX: "hidden"
        }}
      >
        <Stepper activeStep={activeStep}>
          {STEPS_LABELS.map((stepLabel, index) => (
            <Step key={index}>
              <StepLabel>{stepLabel}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      {/* Back/Next buttons */}
      <Box>
        <Box
          sx={{ mt: "24px" }}
          display="flex">
          <Button
            variant="outlined"
            disabled={activeStep === 0}
            onClick={() => {
              setActiveStep(activeStep - 1);
            }}
          >
            Back
          </Button>
          {activeStep !== 6 && (
            <Button
              sx={{
                ml: "12px",
              }}
              variant="outlined"
              disabled={nextButtonIsDisabled}
              onClick={() => {
                setActiveStep(activeStep + 1);
              }}
            >
              Next
            </Button>
          )}
          {/* resent state */}
          <Button
            sx={{
              ml: "auto",
            }}
            variant="outlined"
            disabled={activeStep === 0}
            onClick={() => { resetLocalState(); }
            }
            color="error"
          >
            Reset Storage
          </Button>
        </Box>
        {/* user address and balance */}
        {zkLoginUserAddress && (
          <Stack direction="row" spacing={1} sx={{ mt: "24px" }}>
            <Typography>
              <code>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: "'Noto Sans Mono', monospace;",
                    fontWeight: 600,
                  }}
                >
                  {zkLoginUserAddress}
                </Typography>
              </code>
            </Typography>
            {addressBalance && (
              <Typography>
                Balance:{" "}
                {BigNumber(addressBalance?.totalBalance)
                  .div(MIST_PER_SUI.toString())
                  .toFixed(6)}{" "}
                SUI
              </Typography>
            )}
          </Stack>
        )}
      </Box>
      {/* Box Big Box */}
      <Box sx={{ p: "2px", borderRadius: 2, mt: "10px", border: '3px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          <strong>Βήμα {activeStep + 1}</strong> {STEPS_LABELS[activeStep]}
        </Typography>
        {/* Step 0 */}
        {activeStep === 0 && (
          <Stack spacing={2}>
            <Typography sx={{
              fontSize: "1.25em",
              mb: "12px !important"
            }}>
              Δημιουργούμε ένα ζεύγος <strong>εφήμερων κλειδιών (sk<sub>u</sub>,uk<sub>u</sub>)</strong> με σκοπό
              να τοποθετήσουμε το δημόσιο κλειδί <strong> uk<sub>u</sub></strong> μέσα στο <strong>nonce</strong> του <strong>JWT</strong>.
              Έτσι, το <strong>JWT</strong> λειτουργεί σαν <em> πιστοποιητικό</em> για το
              uk<sub>u</sub>.
            </Typography>
            <SyntaxHighlighter language='javascript' style={oneDark}>

              {`const ephemeralKeyPair = new Ed25519Keypair()`}

            </SyntaxHighlighter>

            {/* Ephemeral Key Button */}
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                disabled={Boolean(ephemeralKeyPair)}
                onClick={() => {
                  const ephemeralKeyPair = Ed25519Keypair.generate();
                  window.sessionStorage.setItem(
                    KEY_PAIR_SESSION_STORAGE_KEY,
                    ephemeralKeyPair.getSecretKey()
                  );
                  setEphemeralKeyPair(ephemeralKeyPair);
                }}
              >
                Δημιουργια Τυχαιου Εφημερου Ζευγους Κλειδιων{" "}
              </Button>
              <Button
                variant="contained"
                color="error"
                disabled={!ephemeralKeyPair}
                onClick={() => {
                  window.sessionStorage.removeItem(
                    KEY_PAIR_SESSION_STORAGE_KEY,
                  );
                  setEphemeralKeyPair(undefined);
                }}
              >
                Εκκαθαριση{" "}
              </Button>
            </Stack>
            <Typography>
              <SyntaxHighlighter
                wrapLongLines
                language="json"
                style={oneDark}>
                {`// PrivateKey
${JSON.stringify(ephemeralKeyPair
                  ? toBase64(decodeSuiPrivateKey(ephemeralKeyPair.getSecretKey()).secretKey)
                  : undefined)
                  }`}
              </SyntaxHighlighter>
              <SyntaxHighlighter
                wrapLongLines
                language="json"
                style={oneDark}>
                {`// PublicKey:
${JSON.stringify(ephemeralKeyPair?.getPublicKey().toBase64())}`}
              </SyntaxHighlighter>
            </Typography>
          </Stack>
        )}
        {/* Step 1 */}
        {activeStep === 1 && (
          <Stack spacing={2}>
            <Typography sx={{
              fontSize: "1.25em",
              mb: "12px !important"
            }}>
              Θέτουμε το χρονικό διάστημα (έως το maxEpoch) όπου το <strong>εφήμερο κλειδί</strong> θα είναι έγκυρο.
            </Typography>
            <SyntaxHighlighter language='javascript' style={oneDark}>

              {`const {epoch, epochDurationMs, epochStartTimestampMs} = await suiClient.getEpochInfo();
const maxEpoch = epoch + 1; // Set the max epoch to the next epoch`}

            </SyntaxHighlighter>
            {/* Fetch Current Epoch Button*/}
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                onClick={async () => {
                  const { epoch } = await suiClient.getLatestSuiSystemState();
                  setCurrentEpoch(epoch);
                  window.localStorage.setItem(
                    MAX_EPOCH_LOCAL_STORAGE_KEY,
                    String(Number(epoch) + 10)
                  );
                  setMaxEpoch(Number(epoch) + 10);
                }}
                sx={{ backgroundColor: 'black', maxHeight: '4em', color: 'white' }}
              >
                Fetch Current Epoch
              </Button>
              <Box sx={{ mt: "6px", alignItems: "center", border: "1px solid gray", p: "8px" }}>
                <code>
                  Current Epoch {CurrentEpoch}
                </code>
              </Box>
            </Stack>
            <Typography sx={{ mt: "6px" }}>
              Αν υποθέσουμε ότι το τρέχον epoch είναι <strong>{CurrentEpoch}</strong>, τότε το <strong>maxEpoch</strong> θα είναι <strong>{maxEpoch}</strong>.
            </Typography>
            <Typography sx={{ mt: "6px" }}>
              Στην συνέχεια δημιουργούμε την τυχαιότητα <strong>randomness</strong> που θα χρησιμοποιηθεί για την
              παραγωγή του <strong>nonce</strong>.
            </Typography>
            <SyntaxHighlighter language='javascript' style={oneDark}>
              {`const randomness =  generateRandomness();`}
            </SyntaxHighlighter>
            <Stack direction={"row"} spacing={2}>
              <Button
                variant="contained"
                onClick={() => {
                  const randomness = generateRandomness();
                  window.sessionStorage.setItem(
                    RANDOMNESS_SESSION_STORAGE_KEY,
                    randomness
                  );
                  setRandomness(randomness);
                }}
              >
                Generate Randomness
              </Button>
              <Typography sx={{ mt: "6px", alignItems: "center", p: "8px" }}>
                {randomness}
              </Typography>
            </Stack>
            <Typography sx={{ mt: "6px" }}>
              Το τελευταίο βήμα αφορά στην κατασκευή του <strong>nonce</strong> που θα χρησιμοποιηθεί στο <strong>JWT</strong>.
            </Typography>
            <SyntaxHighlighter language='javascript' style={oneDark}>
              {`const nonce = generateNonce(randomness, ephemeralKeyPair.getPublicKey(), maxEpoch);`}
            </SyntaxHighlighter>
            <Stack direction={"row"} spacing={2}>
              <Button
                variant="contained"
                disabled={
                  !randomness ||
                  !ephemeralKeyPair ||
                  !maxEpoch ||
                  !CurrentEpoch
                }
                onClick={() => {
                  if (!ephemeralKeyPair || !maxEpoch || !randomness) {
                    console.error("Missing required parameters to generate nonce");
                    return;
                  }
                  const nonce = generateNonce(
                    ephemeralKeyPair.getPublicKey(),
                    maxEpoch,
                    randomness
                  );
                  setNonce(nonce);
                }}
              >
                Generate Nonce
              </Button>
              <Typography sx={{ mt: "6px", alignItems: "center", p: "8px" }}>
                {nonce}
              </Typography>
            </Stack>
            <Button
              sx={{
                mt: "2px",
                width: "20%",
              }}
              disabled={!nonce}
              variant="contained"
              onClick={() => {
                const params = new URLSearchParams({
                  client_id: CLIENT_ID,
                  redirect_uri: REDIRECT_URI + "/how",
                  response_type: "id_token",
                  scope: "openid",
                  nonce: nonce,
                });
                const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
                window.location.replace(googleLoginUrl);
              }}
            >
              <img
                src={GoogleLogo}
                width="16px"
                style={{ marginRight: "8px" }}
                alt="Google"
              />{" "}
              Sign in with Google
            </Button>
          </Stack>
        )}
        {/* Step 2 */}
        {activeStep === 2 && (
          <Box>
            {decodedJwt && (
              <Alert
                variant="standard"
                color="success"
                sx={{
                  fontWeight: 600,
                }}
              >
                Successfully logged in via Google!
              </Alert>
            )}
            <Typography sx={{
              fontSize: "1.25em",
              mb: "12px !important"
            }}>
              Αποκωδικοποιούμε το <strong>JWT</strong> που λάβαμε από την Google και εξάγουμε το <strong>nonce</strong>.
            </Typography>
            <SyntaxHighlighter language='javascript' style={oneDark}>
              {`//JWT: header.payload.signature
"${jwtString}";              
const jwtPayload = jwtDecode(id_token);
const decodedJwt = jwt_decode(jwtPayload) as JwtPayload;
`}

            </SyntaxHighlighter>
            <SyntaxHighlighter language='json' style={oneDark}>
              {JSON.stringify(decodedJwt, null, 2)}
            </SyntaxHighlighter>
            <Stack
              spacing={1}
              sx={{
                m: "24px 0",
              }}
            >
              <Typography>
                <code>iss (issuer)</code>：<b>Εκδότης</b>
              </Typography>
              <Typography>
                <code>aud (audience)</code>：<b>Παραλήπτης (Client-Id).</b>
              </Typography>
              <Typography>
                <code>sub (subject)</code>：<b>Αναγνωριστικό, μοναδικό για κάθε χρήστη</b>
              </Typography>
              <Typography>
                <code>nonce: </code>Χρησιμοποιείται για αποφυγή replay attacks.
              </Typography>
              <Typography>
                <code>nbf (Not Before)</code>： Εκδόθηκε μετά από αυτή την ώρα.
              </Typography>
              <Typography>
                <code>iat(Issued At)</code>： Εκδόθηκε σε αυτή την ώρα.
              </Typography>
              <Typography>
                <code>exp (expiration time)</code>： Λήγει σε αυτή την ώρα.
              </Typography>
              <Typography>
                <code>jti (JWT ID)</code>： JWT ID
              </Typography>
            </Stack>
          </Box>

        )}
        {/* Step 3 */}
        {activeStep === 3 && (
          <Stack spacing={2}>
            <Typography sx={{
              fontSize: "1.25em",
              mb: "12px !important"
            }}>
              Το <strong> αλάτισμα </strong> χρησιμοποιείται για να εξασφαλιστεί ότι δεν υπάρχει ένα-προς-ένα
              αντιστοιχία μεταξύ του sub και της Sui address.
            </Typography>
            <Alert
              severity="warning"
              sx={{
                fontWeight: 600
              }}
            >
              Επομένως είναι απαραίτητο να αποθηκεύσουμε το <strong>userSalt</strong>. Αν χαθεί,
              ο χρήστης δεν θα μπορεί να ανακτήσει την διεύθυνση που παρήγαγε με το τωρινό <strong>userSalt</strong>.
            </Alert>
            <SyntaxHighlighter language='javascript' style={oneDark}>
              {`const userSalt = generateRandomness();`}
            </SyntaxHighlighter>
            <Stack direction={"row"} spacing={2}>
              <Button
                variant="contained"
                disabled={Boolean(userSalt)}
                onClick={() => {
                  const userSalt = generateRandomness();
                  window.localStorage.setItem(
                    USER_SALT_LOCAL_STORAGE_KEY,
                    userSalt
                  );
                  setUserSalt(userSalt);
                }}
              >
                Generate User Salt
              </Button>
              <Button
                variant="outlined"
                disabled={!userSalt}
                onClick={() => {
                  if (userSalt) {
                    window.localStorage.removeItem(USER_SALT_LOCAL_STORAGE_KEY);
                    setUserSalt("");
                  }
                }}
              >
                Remove User Salt
              </Button>


            </Stack>
            <Typography sx={{ mt: "6px", alignItems: "center", p: "8px" }}>
              {userSalt}
            </Typography>
          </Stack>
        )}
        {/* Step 4 */}
        {activeStep === 4 && (
          <Stack spacing={2}>
            <Typography sx={{
              fontSize: "1.25em",
              mb: "12px !important"
            }}>
              Όταν ολοκληρωθεί το Oauth flow και έχουμε πλέον στην κατοχή μας το <strong>JWT</strong> και το <strong>userSalt</strong>, μπορούμε να δημιουργήσουμε την διεύθυνση Sui του χρήστη.
            </Typography>
            <SyntaxHighlighter language='javascript' style={oneDark}>
              {`import {jwtToAddress} from '@mysten/sui/zklogin';
              const zkLoginAddress = jwtToAddress(jwt, userSalt);`}
            </SyntaxHighlighter>
            <Box>
              <Button
                variant="contained"
                disabled={!jwtString || !userSalt || Boolean(zkLoginUserAddress)}
                onClick={async () => {
                  if (!userSalt) {
                    return;
                  }
                  const zkLoginUserAddress = jwtToAddress(jwtString, userSalt);
                  setZkLoginUserAddress(zkLoginUserAddress);
                }}>
                Δημιουργία Διεύθυνσης Sui
              </Button>
            </Box>
            <Stack direction={"row"} spacing={2} sx={{ mt: "12px" }}>
              <Typography sx={{ fontSize: "1.25em" }}>
                User Sui Address:{" "}
                {zkLoginUserAddress && (
                  <code>
                    <Typography
                      component="span"
                      sx={{
                        fontFamily: "'Noto Sans Mono', monospace",
                        fontWeight: 600
                      }}
                    >
                      {zkLoginUserAddress}
                    </Typography>
                  </code>
                )}
              </Typography>
              <Button
                variant="contained"
                sx={{ ml: "24px" }}
                size="small"
                loading={requestingFaucet}
                disabled={!zkLoginUserAddress}
                onClick={requestFaucet}
              >
                Request Balance
              </Button>
            </Stack>
          </Stack>
        )}
        {/* Step 5 */}
        {activeStep === 5 && (
          <Stack spacing={2}>
            <Typography sx={{
              fontSize: "1.25em",
              mb: "12px !important"
            }}>
              Τέλος, μπορούμε να δημιουργήσουμε την Απόδειξη Μηδενικής Γνώσης (ZKP) για να εκτελέσουμε
              συναλλαγές με την διεύθυνση Sui που δημιουργήσαμε.
              Η απόδειξη αυτή πιστοποιεί ότι το εφήμερο κλειδί είναι έγκυρο.
            </Typography>
            <SyntaxHighlighter language="typescript" style={oneDark}>
              {`import {getExtendedEphemeralPublicKey} from "@mysten/sui/zklogin";
const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());`}
            </SyntaxHighlighter>
            <Box>
              <Button
                variant="contained"
                onClick={() => {
                  if (!ephemeralKeyPair) {
                    return;
                  }
                  const extendedEphemeralPublicKey =
                    getExtendedEphemeralPublicKey(
                      ephemeralKeyPair.getPublicKey()
                    );

                  setExtendedEphemeralPublicKey(extendedEphemeralPublicKey);
                }}
              >
                Generate Extended Ephemeral Public Key
              </Button>
              <Typography
                sx={{
                  mt: "12px",
                }}
              >
                extendedEphemeralPublicKey:  {extendedEphemeralPublicKey && (
                  <code>{extendedEphemeralPublicKey}</code>
                )}
              </Typography>
              <Typography
                sx={{
                  mt: "12px",
                }}
              >
                Τώρα χρησιμοποιούμε το παραπάνω κλειδί για να παράγουμε την απόδειξη.
                <code></code>
              </Typography>
              <SyntaxHighlighter
                language="typescript"
                style={oneDark}>
                {`const zkProofResult = await axios.post(
  "https://prover-dev.mystenlabs.com/v1",
  {
    jwt: oauthParams?.id_token as string,
    extendedEphemeralPublicKey: extendedEphemeralPublicKey,
    maxEpoch: maxEpoch,
    jwtRandomness: randomness,
    salt: userSalt,
    keyClaimName: "sub",
  },
  {
    headers: {
      "Content-Type": "application/json",
    },
  }
).data;

const partialZkLoginSignature = zkProofResult as PartialZkLoginSignature`}
              </SyntaxHighlighter>
              <Box>
                <Button
                  loading={fetchingZKProof}
                  disabled={
                    !oauthParams?.id_token ||
                    !extendedEphemeralPublicKey ||
                    !maxEpoch ||
                    !randomness ||
                    !userSalt
                  }
                  variant="contained"
                  onClick={async () => {
                    try {
                      setFetchingZKProof(true);
                      const zkProofResult = await axios.post(
                        SUI_PROVER_DEV_ENDPOINT,
                        {
                          jwt: oauthParams?.id_token as string,
                          extendedEphemeralPublicKey: extendedEphemeralPublicKey,
                          maxEpoch: maxEpoch,
                          jwtRandomness: randomness,
                          salt: userSalt,
                          keyClaimName: "sub",
                        },
                        {
                          headers: {
                            "Content-Type": "application/json",
                          },
                        }
                      );
                      setZkProof(zkProofResult.data as PartialZkLoginSignature);
                      enqueueSnackbar("Successfully obtain ZK Proof", {
                        variant: "success",
                      });
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    } catch (error: any) {
                      console.error(error);
                      enqueueSnackbar(
                        String(error?.response?.data?.message || error),
                        {
                          variant: "error",
                        }
                      );
                    } finally {
                      setFetchingZKProof(false);
                    }
                  }}
                >
                  Fetch ZKP
                </Button>
                {zkProof && (
                  <SyntaxHighlighter
                    wrapLongLines
                    language="typescript"
                    style={oneDark}
                  >
                    {JSON.stringify(zkProof, null, 2)}
                  </SyntaxHighlighter>
                )}
              </Box>
            </Box>
          </Stack>
        )}
        {activeStep === 6 && (
          <Box>
            <Typography
              sx={{
                fontSize: "1.25rem",
                fontWeight: 600,
                mb: "12px !important",
              }}
            >
              {""}
            </Typography>
            <Alert severity="warning"> Προσοχή!</Alert>
            <Typography sx={{ mt: "12px" }}>{" "}</Typography>
            <SyntaxHighlighter
              wrapLongLines
              language="typescript"
              style={oneDark}
            >
              {'const txb = new TransactionBlock()'}
            </SyntaxHighlighter>
            <Button
              variant="contained"
              loading={executingTxn}
              disabled={!decodedJwt}
              onClick={async () => {
                try {
                  if (
                    !ephemeralKeyPair ||
                    !zkProof ||
                    !decodedJwt ||
                    !userSalt
                  ) {
                    return;
                  }
                  setExecutingTxn(true);
                  const txb = new Transaction();

                  const [coin] = txb.splitCoins(txb.gas, [MIST_PER_SUI * 1n]);
                  txb.transferObjects(
                    [coin],
                    "0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36"
                  );
                  txb.setSender(zkLoginUserAddress);

                  const { bytes, signature: userSignature } = await txb.sign({
                    client: suiClient,
                    signer: ephemeralKeyPair,
                  });

                  if (!decodedJwt?.sub || !decodedJwt.aud) {
                    return;
                  }

                  const addressSeed: string = genAddressSeed(
                    BigInt(userSalt),
                    "sub",
                    decodedJwt.sub,
                    decodedJwt.aud as string
                  ).toString();

                  const zkLoginSignature =
                    getZkLoginSignature({
                      inputs: {
                        ...zkProof,
                        addressSeed,
                      },
                      maxEpoch,
                      userSignature,
                    });

                  const executeRes = await suiClient.executeTransactionBlock({
                    transactionBlock: bytes,
                    signature: zkLoginSignature
                  });

                  enqueueSnackbar(
                    `Execution successful: ${executeRes.digest}`,
                    {
                      variant: "success",
                    }
                  );

                  setExecuteDigest(executeRes.digest);


                } catch (error) {
                  console.log(error);
                  enqueueSnackbar(String(error), {
                    variant: "error"
                  });
                } finally {
                  setExecutingTxn(false);
                }
              }}
            >
              sd
            </Button>

          </Box>
        )}


      </Box>
    </Box>
  );
}
export default HowItWorksPage
