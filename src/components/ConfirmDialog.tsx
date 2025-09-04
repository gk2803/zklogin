import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

export default function ConfirmDialog({
  open,
  amount,
  address,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  amount?: string;
  address?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Confirm Transaction</DialogTitle>
      <DialogContent>
        <Typography>
          Send {amount} SUI to {address}?<br />
          Note: Each transaction will incur a small gas fee.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained" color="primary">
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}
