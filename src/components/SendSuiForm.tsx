import { Box, Button, Typography } from "@mui/material";
import search from "../assets/search.svg";
import { useState } from "react";
import { validateAddress } from "../utils/validator";
import { useSnackbar } from "notistack";

export type PendingTx = { address: string; amount: string };

export default function SendSuiForm({
  disabled,
  balanceMist,
  toMist,
  onConfirm,
}: {
  disabled: boolean;
  balanceMist?: string;
  toMist: (s: string) => bigint;
  onConfirm: (tx: PendingTx) => void;
}) {
  const [address, setAddress] = useState("0xfa0f8542f256e669694624aa3ee7bfbde5af54641646a3a05924cf9e329a8a36");

  const {enqueueSnackbar} = useSnackbar()
  
  return (
    <Box sx={{ p: 1, borderRadius: 2, mt: 1, border: "3px solid", borderColor: "divider", bgcolor: "background.paper" }}>
      <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: "'Noto Sans Mono', monospace", letterSpacing: 1, mb: 2 }}>
        Send Sui
      </Typography>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const addr = (fd.get("address") as string)?.trim();
          const amount = (fd.get("amount") as string)?.trim();

          const err = validateAddress(addr);
          if (err) return enqueueSnackbar(err, { variant: "error" });

          const n = Number(amount);
          if (!Number.isFinite(n) || n <= 0) return enqueueSnackbar("Enter a positive amount.", { variant: "error" });

          if (balanceMist && BigInt(balanceMist) < toMist(amount)) {
            return enqueueSnackbar("Insufficient SUI", { variant: "error" });
          }

          onConfirm({ address: addr, amount });
        }}
        style={{ display: "flex", flexDirection: "column", gap: 16, width: 620 }}
      >
        <Box>
          <Typography>Send to</Typography>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="text"
              name="address"
              placeholder="Recipient Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ flex: 1, padding: 10, fontSize: 16, borderRadius: 8, border: "1px solid #ccc" }}
              required
            />
            <button
              type="button"
              onClick={() => {
                const err = validateAddress(address);
                if (err) return enqueueSnackbar(err, { variant: "error" });
                window.open(`https://explorer.polymedia.app/address/${address}?network=devnet`, "_blank");
              }}
              style={{ border: "none", background: "transparent", cursor: "pointer" }}
              aria-label="Open in explorer"
              title="Open in explorer"
            >
              <img src={search} width={20} height={20} />
            </button>
          </div>
        </Box>

        <Box>
          <Typography>Amount</Typography>
          <input
            type="text"
            name="amount"
            placeholder="Amount"
            style={{ width: "100%", padding: 10, fontSize: 16, borderRadius: 8, border: "1px solid #ccc" }}
            required
          />
        </Box>

        <Button type="submit" variant="contained" disabled={disabled} sx={{ width: "100%", mt: 1 }}>
          Send
        </Button>
      </form>
    </Box>
  );
}
