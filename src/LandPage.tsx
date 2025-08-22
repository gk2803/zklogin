import BigNumber from "bignumber.js";
import { enqueueSnackbar } from "notistack";
import axios from "axios";
import { Transaction } from "@mysten/sui/transactions"
import { useSuiClientQuery } from "@mysten/dapp-kit";
import {
    MIST_PER_SUI,
    normalizeSuiAddress,
    isValidSuiAddress
} from "@mysten/sui/utils";
import {
    Stack,
    Typography,
    Box,
    Button,
    CircularProgress
} from "@mui/material";
import GoogleLogo from "./assets/GoogleLogo.svg";
import { useState, useEffect } from "react";
import queryString from "query-string";
import { useLocation, useNavigate } from "react-router-dom";
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import {
    generateNonce,
    generateRandomness,
    getExtendedEphemeralPublicKey,
    jwtToAddress,
    getZkLoginSignature,
    genAddressSeed
} from '@mysten/sui/zklogin';
import { type JwtPayload, jwtDecode } from "jwt-decode";
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
import { red } from "@mui/material/colors";

export type PartialZkLoginSignature = Omit<
    Parameters<typeof getZkLoginSignature>["0"]["inputs"],
    "addressSeed"
>;

const suiClient = new SuiClient({ url: FULLNODE_URL });
function LandPage() {
    // States 
    const [executeDigest, setExecuteDigest] = useState("")
    const [nonce, setNonce] = useState("");
    const [ephemeralKeyPair, setEphemeralKeyPair] = useState<Ed25519Keypair>();
    const [currentEpoch, setCurrentEpoch] = useState("");
    const [randomness, setRandomness] = useState("");
    const [maxEpoch, setMaxEpoch] = useState(0);
    const [jwtString, setJwtString] = useState("");
    const [decodedJwt, setDecodedJwt] = useState<JwtPayload>();
    const [oauthParams, setOauthParams] = useState<queryString.ParsedQuery<string>>();
    const [userSalt, setUserSalt] = useState<string>();
    const [zkLoginUserAddress, setZkLoginUserAddress] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [redirecting, setRedirecting] = useState(false);
    const [requestingFaucet, setRequestingFaucet] = useState(false);
    const [extendedEphemeralPublicKey, setExtendedEphemeralPublicKey] = useState("")
    const [zkProof, setZkProof] = useState<PartialZkLoginSignature>();
    const [fetchingZKProof, setFetchingZKProof] = useState(false);
    const [executingTxn, setExecutingTxn] = useState(false);

    const location = useLocation();

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

    // reset state 
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
        setFetchingZKProof(false);
        setExecutingTxn(false);
        setExecuteDigest("");
    };

    const resetLocalState = () => {
        try {
            window.sessionStorage.clear();
            window.localStorage.clear();
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

    // Parse OAuth parameters from the URL
    useEffect(() => {
        const res = queryString.parse(location.hash);
        setOauthParams(res);
    }, [location]);

    /* If oauthParams is set, decode the JWT, set the jwtString  with the id_token, set the DecodedJwt and move to step 2 */
    useEffect(() => {
        if (oauthParams && oauthParams.id_token) {

            setIsLoggedIn(true);
            const decodedJwt = jwtDecode(oauthParams.id_token as string);
            setJwtString(oauthParams.id_token as string);
            setDecodedJwt(decodedJwt);
            // Generate Sui Address 
            const userSalt = window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY);
            const zkLoginUserAddress = jwtToAddress(oauthParams.id_token as string, userSalt as string);
            setZkLoginUserAddress(zkLoginUserAddress);

            // Generate extended ephemeral key pair from the ephemeral key pair
            if (!ephemeralKeyPair) {
                console.log("Eph key not found?!");
                return;
            }

            

        }
    }, [oauthParams]);

    /* zkproof generation */
    useEffect(() => {

        if (!ephemeralKeyPair){
            return;
        }

        const extendedEphemeralPublicKey =
                getExtendedEphemeralPublicKey(
                    ephemeralKeyPair.getPublicKey()
                );
            setExtendedEphemeralPublicKey(extendedEphemeralPublicKey);
        if (
            ephemeralKeyPair &&
            maxEpoch &&
            randomness &&
            userSalt &&
            oauthParams?.id_token
        ) {
            // Generate proof remotely
            const fetch_proof = async () => {
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
                    // zkLoginSignature contains {proof, addressSeed, maxEpoch, userSignature}
                    // everything except addressSeed is considered a PartialZkLoginSignature.
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
            }
            fetch_proof();
        }
    }, [ephemeralKeyPair, maxEpoch, randomness, userSalt, oauthParams])



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

// Requesting Balance from Faucet
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

return (
    <Box >
        {/* user address and balance */}
        {isLoggedIn ? (
            <Stack
            >
                <Box sx={{ p: "2px", borderRadius: 2, mt: "10px", border: '3px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    {/* Header */}
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            fontFamily: "'Noto Sans Mono', monospace",
                            letterSpacing: 1,
                            mb: 2
                        }}
                    >
                        Google Account
                    </Typography>

                    <Typography
                        sx={{
                            fontFamily: "'Noto Sans Mono', monospace;",
                            // highlight the address with some background color 
                            /* bgcolor: "#FCE9C2", */
                        }}
                    >
                        Address: {zkLoginUserAddress}
                    </Typography>
                    {addressBalance && (
                        <Stack
                            direction="row">
                            <Typography>
                                Balance:{" "}
                                {BigNumber(addressBalance?.totalBalance)
                                    .div(MIST_PER_SUI.toString())
                                    .toFixed(6)}{" "}
                                SUI
                            </Typography>
                            <Box sx={{ position: "relative", bottom: "4px" }}>
                                <Button
                                    sx={{
                                        ml: "12px",
                                        alignSelf: "flex-end",
                                        /* mb: 2 */
                                    }}
                                    size="small"
                                    loading={requestingFaucet}
                                    disabled={!zkLoginUserAddress}
                                    onClick={requestFaucet}
                                    variant="contained"
                                >
                                    +10 Sui
                                </Button>
                            </Box>
                        </Stack>
                    )}
                    <Typography
                        sx={{ fontFamily: "'Noto Sans Mono', monospace;", }}>
                        Network:{" Devnet"}
                    </Typography>
                </Box>
                <Box sx={{ p: "2px", borderRadius: 2, mt: "10px", border: '3px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            fontFamily: "'Noto Sans Mono', monospace",
                            letterSpacing: 1,
                            mb: 2
                        }}
                    >
                        Send Sui
                    </Typography>

                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const address = (formData.get("address") as string)?.trim();
                            const amount = (formData.get("amount") as string)?.trim();

                            // validate address
                            if (!address) {
                                enqueueSnackbar("Address is required.", { variant: "error" });
                                return;
                            }

                            if (!isValidSuiAddress(address)) {
                                enqueueSnackbar("Invalid SUI address format.", { variant: "error" });
                                return;
                            }

                            const suiAddress = normalizeSuiAddress(address);

                            // validate amount
                            const amountNum = Number(amount);
                            if (!Number.isFinite(amountNum) || amountNum <= 0) {
                                enqueueSnackbar("Enter a positive amount.", { variant: "error" })
                                return;
                            }

                            // sui to mist convertion
                            const transactionMist = (() => {
                                const [intPart, fracPart = ""] = amount.split(".");
                                const frac9 = (fracPart + "000000000").slice(0, 9);
                                return (BigInt(intPart || "0") * MIST_PER_SUI) + BigInt(frac9);

                            })();


                            // verify if transactionMist>=addressBalance
                            if (!addressBalance) {
                                return;
                            }

                            if (BigInt(addressBalance?.totalBalance) < transactionMist) {
                                enqueueSnackbar(`Insufficient SUI `, { variant: "error" });
                                return;
                            }

                            // create transaction
                            try {
                                if (
                                    !ephemeralKeyPair ||
                                    !zkProof ||
                                    !decodedJwt ||
                                    !userSalt
                                ) {
                                    enqueueSnackbar("Missing prequisites.", { variant: "error" });
                                    console.log({ ephemeralKeyPair, zkProof, decodedJwt, userSalt });
                                    return;
                                }
                                setExecutingTxn(true);
                                const txb = new Transaction();
                                const [coin] = txb.splitCoins(txb.gas, [transactionMist]);
                                // transfer coins to <address>
                                txb.transferObjects(
                                    [coin],
                                    address
                                );

                                
                                txb.setSender(zkLoginUserAddress);

                                // sign the transaction with the secret key of the ephemeral key
                                const { bytes, signature: userSignature } = await txb.sign(
                                    {
                                        client: suiClient,
                                        signer: ephemeralKeyPair,
                                    }
                                );

                                if (!decodedJwt?.sub || !decodedJwt.aud) {
                                    return;
                                }

                                // this is the seed from which the zkloginaddress is derived
                                const addressSeed: string = genAddressSeed(
                                    BigInt(userSalt),
                                    "sub",
                                    decodedJwt.sub,
                                    decodedJwt.aud as string
                                ).toString();

                                // 
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
                        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                    ><Box>
                            <Typography>
                                Send to
                            </Typography>
                        </Box>
                        <input
                            type="text"
                            name="address"
                            placeholder="Recipient Address"
                            defaultValue="0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36"
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '16px',
                                borderRadius: '8px',
                                border: '1px solid #ccc'
                            }}
                            required
                        />
                        <Box>
                            <Typography>
                                Amount
                            </Typography>
                        </Box>
                        <input
                            type="text"
                            name="amount"
                            placeholder="Amount"
                            style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '16px',
                                borderRadius: '8px',
                                border: '1px solid #ccc'
                            }}
                            required
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={!zkProof }
                            sx={{ width: '100%', mt: 1 }}
                        >
                            Send
                        </Button>
                    </form>
                </Box>

            </Stack>
        ) : (
            <Box
                sx={{
                    width: '30%',
                    fontSize: '30px',
                    cursor: 'pointer',
                    backgroundColor: '#343434',
                    color: 'white',
                    border: 'none',
                    borderRadius: '30px',
                    margin: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1px',
                }}>
                <Button
                    onClick={async () => {
                        setRedirecting(true);

                        // Generate ephemeral key pair 
                        const ephemeralKeyPair = Ed25519Keypair.generate();
                        setEphemeralKeyPair(ephemeralKeyPair);
                        window.sessionStorage.setItem(KEY_PAIR_SESSION_STORAGE_KEY, ephemeralKeyPair.getSecretKey());

                        // fetch epoch 
                        const { epoch } = await suiClient.getLatestSuiSystemState();
                        const maxEpoch = Number(epoch) + 10
                        setCurrentEpoch(epoch);
                        setMaxEpoch(Number(epoch) + 10);
                        window.localStorage.setItem(MAX_EPOCH_LOCAL_STORAGE_KEY, String(maxEpoch));


                        // Generate randomness
                        const randomness = generateRandomness();
                        setRandomness(randomness);
                        window.sessionStorage.setItem(RANDOMNESS_SESSION_STORAGE_KEY, randomness);

                        // Generate nonce 
                        const nonce = generateNonce(
                            ephemeralKeyPair.getPublicKey(),
                            maxEpoch,
                            randomness
                        );
                        setNonce(nonce);
                        
                        if (!window.localStorage.getItem(USER_SALT_LOCAL_STORAGE_KEY)) {
                            const userSalt = generateRandomness();
                            setUserSalt(userSalt);
                            window.localStorage.setItem(USER_SALT_LOCAL_STORAGE_KEY, userSalt);
                        }

                        const params = new URLSearchParams({
                            client_id: CLIENT_ID,
                            redirect_uri: REDIRECT_URI + "/",
                            response_type: "id_token",
                            scope: "openid",
                            nonce: nonce,
                        });
                        const googleLoginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
                        window.location.replace(googleLoginUrl);

                    }}
                    style={{
                        color: 'white',
                        width: '30%',
                        fontSize: '30px',
                        cursor: 'pointer',
                        backgroundColor: '#343434',
                        border: 'none',
                        borderRadius: '30px',
                        margin: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '1px',
                    }}
                >
                    {redirecting ? (
                        <>
                            <CircularProgress size={24} sx={{ color: 'white' }} />
                            Redirecting
                        </>
                    ) : (
                        <>
                            <img src={GoogleLogo} alt="Google Logo" style={{ width: '30px', height: '30px' }} />
                            Login with Google
                        </>
                    )
                    }
                </Button>
            </Box>

        )

        }




    </Box >


)
}

export default LandPage