import { Box, Button, Stack, Typography } from "@mui/material";
import BigNumber from "bignumber.js";
import { MIST_PER_SUI } from "@mysten/sui/utils";

export default function AccountCard({
  address,
  balance,
  onFaucet,
  onSignOut,
  requestingFaucet,
}: {
  address: string;
  balance?: { totalBalance: string };
  onFaucet: () => void;
  onSignOut: () => void;
  requestingFaucet: boolean;
}) {
  return (
    <Box sx={{ p: 1, borderRadius: 2, mt: 1, border: "3px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "'Noto Sans Mono', monospace", letterSpacing: 1, mb: 2 }}>
        Google Account
      </Typography>

      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button size="small" variant="contained" onClick={onSignOut}>
          Signout
        </Button>
      </Stack>
      <Typography sx={{ fontFamily: "'Noto Sans Mono', monospace" }}>
        Address: {address}
      </Typography>

      {balance && (
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography>
            Balance: {BigNumber(balance.totalBalance).div(MIST_PER_SUI.toString()).toFixed(6)} SUI
          </Typography>
          <Button
            size="small"
            variant="contained"
            disabled={!address || requestingFaucet}
            onClick={onFaucet}
          >
            +10 Sui
          </Button>
        </Stack>
      )}

      <Typography sx={{ fontFamily: "'Noto Sans Mono', monospace" }}>
        Network: Devnet
      </Typography>
    </Box>
  );
}
