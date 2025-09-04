import { Button, CircularProgress, Box } from "@mui/material";
import GoogleLogo from "../assets/GoogleLogo.svg";

export default function LoginWithGoogleButton({
  onClick,
  redirecting,
}: {
  onClick: () => void;
  redirecting: boolean;
}) {
  return (
    <Box
      sx={{
        width: "30%",
        margin: "10px auto",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Button
        onClick={onClick}
        sx={{
          color: "white",
          width: "100%",
          fontSize: "30px",
          backgroundColor: "#343434",
          borderRadius: "30px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          py: 1.5,
        }}
      >
        {redirecting ? (
          <>
            <CircularProgress size={24} sx={{ color: "white" }} />
            Redirecting
          </>
        ) : (
          <>
            <img src={GoogleLogo} alt="Google Logo" width={30} height={30} />
            Login with Google
          </>
        )}
      </Button>
    </Box>
  );
}
