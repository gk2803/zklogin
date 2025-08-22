// src/app/App.tsx
import { Box, Typography } from "@mui/material";
import { useSnackbar } from "notistack";
import { useZkLogin } from "../hooks/useZkLogin";
import { toMist, executeZkTransfer } from "../services/sui";
import LoginWithGoogleButton from "../components/LoginWithGoogleButton";
import AccountCard from "../components/AccountCard";
import SendSuiForm from "../components/SendSuiForm";
import ConfirmDialog from "../components/ConfirmDialog";

export default function App() {
  const zk = useZkLogin();
  const {enqueueSnackbar} = useSnackbar();

  return (

    <Box sx={{ mb: "36px", mx: "100px" }}>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        zkLogin Demo
      </Typography>

      {zk.isLoggedIn ? (
        <>
          <AccountCard
            address={zk.zkLoginUserAddress}
            balance={zk.balance}
            requestingFaucet={zk.requestingFaucet}
            onFaucet={() => zk.faucet(zk.zkLoginUserAddress)}
            onSignOut={zk.signOut}
          />

          <SendSuiForm
            disabled={!zk.zkProof}
            balanceMist={zk.balance?.totalBalance}
            toMist={toMist}
            onConfirm={(tx) => {
              zk.setPendingTx(tx);
              zk.setConfirmOpen(true);
            }}
          />

          <ConfirmDialog
            open={zk.confirmOpen}
            amount={zk.pendingTx?.amount}
            address={zk.pendingTx?.address}
            onCancel={() => zk.setConfirmOpen(false)}
            onConfirm={async () => {
              zk.setConfirmOpen(false);
              if (!zk.pendingTx || !zk.ephemeralKeyPair || !zk.zkProof || !zk.decodedJwt || !zk.userSalt)
                return enqueueSnackbar("Missing prerequisites.", { variant: "error" });

              try {
                const res = await executeZkTransfer({
                  client: zk.client,
                  sender: zk.zkLoginUserAddress,
                  recipient: zk.pendingTx.address,
                  amountSui: zk.pendingTx.amount,
                  ephemeralSigner: zk.ephemeralKeyPair,
                  jwtSub: zk.decodedJwt.sub!,
                  jwtAud: String(zk.decodedJwt.aud!),
                  userSalt: zk.userSalt,
                  zkProof: zk.zkProof,
                  maxEpoch: zk.maxEpoch,
                });
                enqueueSnackbar(`Execution successful: ${res.digest}`, { variant: "success" });
              } catch (e) {
                enqueueSnackbar(String(e), { variant: "error" });
              }
            }}
          />
        </>
      ) : (
        <LoginWithGoogleButton onClick={zk.startLogin} redirecting={zk.redirecting} />
      )}
    </Box>
  );
}
