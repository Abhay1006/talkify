import { useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as yup from "yup";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  InputAdornment,
  IconButton,
  CircularProgress,
  Link as MuiLink,
  ToggleButtonGroup,
  ToggleButton,
  LinearProgress,
} from "@mui/material";
import { Person, Lock, Edit, Visibility, VisibilityOff, Wc } from "@mui/icons-material";
import useSignup from "../../hooks/useSignup";

const validationSchema = yup.object({
  fullName: yup
    .string()
    .trim()
    .max(50, "Full Name cannot exceed 50 characters")
    .required("Full Name is required"),
  // Mirrors USERNAME_PATTERN in backend/controllers/auth.controller.js.
  username: yup
    .string()
    .trim()
    .matches(/^[a-z0-9_.]{3,20}$/, "3-20 characters: lowercase letters, numbers, dots and underscores")
    .required("Username is required"),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password cannot exceed 72 characters")
    .required("Password is required"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password"), null], "Passwords must match")
    .required("Confirm Password is required"),
  gender: yup.string().oneOf(["male", "female"]).required("Gender is required"),
});

const calculateStrength = (password) => {
  let strength = 0;
  if (password.length >= 6) strength += 25;
  if (password.match(/[A-Z]/)) strength += 25;
  if (password.match(/[0-9]/)) strength += 25;
  if (password.match(/[^A-Za-z0-9]/)) strength += 25;
  return strength;
};

const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { loading, signup } = useSignup();

  const formik = useFormik({
    initialValues: {
      fullName: "",
      username: "",
      password: "",
      confirmPassword: "",
      gender: "",
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      await signup(values);
    },
  });

  const passwordStrength = calculateStrength(formik.values.password);

  const getStrengthColor = (strength) => {
    if (strength <= 25) return "error";
    if (strength <= 50) return "warning";
    if (strength <= 75) return "info";
    return "success";
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        "@supports (min-height: 100dvh)": { minHeight: "100dvh" },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: { xs: "flex-start", sm: "center" },
        p: { xs: 2, sm: 2 },
        py: { xs: 2, sm: 4 },
        width: "100%",
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          width: "100%",
          maxWidth: { xs: "100%", sm: 600 },
          borderRadius: { xs: 3, sm: 4 },
        }}
      >
        <Box textAlign="center" mb={{ xs: 2.5, sm: 4 }}>
          <Typography
            variant="h3"
            fontWeight="bold"
            color="text.primary"
            gutterBottom
            sx={{ fontSize: { xs: "1.8rem", sm: "3rem" } }}
          >
            Talk
            <Typography
              component="span"
              variant="h3"
              color="primary"
              fontWeight="bold"
              sx={{ fontSize: "inherit" }}
            >
              ify
            </Typography>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: "0.85rem", sm: "1rem" } }}>
            Create your account to start talking.
          </Typography>
        </Box>

        <form onSubmit={formik.handleSubmit}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 2, sm: 3 } }}>
              <TextField
                fullWidth
                id="fullName"
                name="fullName"
                label="Full Name"
                value={formik.values.fullName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.fullName && Boolean(formik.errors.fullName)}
                helperText={formik.touched.fullName && formik.errors.fullName}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Edit />
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                fullWidth
                id="username"
                name="username"
                label="Username"
                value={formik.values.username}
                // Usernames are stored lowercase; show that as the user types.
                onChange={(e) => formik.setFieldValue("username", e.target.value.toLowerCase())}
                autoComplete="username"
                autoCapitalize="none"
                onBlur={formik.handleBlur}
                error={formik.touched.username && Boolean(formik.errors.username)}
                helperText={formik.touched.username && formik.errors.username}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <Person />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 2, sm: 3 } }}>
              <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  label="Password"
                  autoComplete="new-password"
                  type={showPassword ? "text" : "password"}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.password && Boolean(formik.errors.password)}
                  helperText={formik.touched.password && formik.errors.password}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            sx={{ minWidth: 44, minHeight: 44 }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                {formik.values.password && (
                  <Box sx={{ mt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={passwordStrength}
                      color={getStrengthColor(passwordStrength)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                )}
              </Box>

              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  id="confirmPassword"
                  name="confirmPassword"
                  label="Confirm Password"
                  autoComplete="new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
                  helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            edge="end"
                            sx={{ minWidth: 44, minHeight: 44 }}
                          >
                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
              </Box>
            </Box>

            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  fontSize: { xs: "0.8rem", sm: "0.875rem" },
                }}
              >
                <Wc fontSize="small" /> Gender
              </Typography>
              <ToggleButtonGroup
                color="primary"
                value={formik.values.gender}
                exclusive
                onChange={(e, newGender) => {
                  if (newGender !== null) {
                    formik.setFieldValue("gender", newGender);
                  }
                }}
                fullWidth
                sx={{ mt: 1 }}
              >
                <ToggleButton value="male" sx={{ minHeight: 44 }}>
                  Male
                </ToggleButton>
                <ToggleButton value="female" sx={{ minHeight: 44 }}>
                  Female
                </ToggleButton>
              </ToggleButtonGroup>
              {formik.touched.gender && formik.errors.gender && (
                <Typography color="error" variant="caption" sx={{ mt: 1, display: "block", ml: 2 }}>
                  {formik.errors.gender}
                </Typography>
              )}
            </Box>

            <Box display="flex" justifyContent="flex-end">
              <MuiLink
                component={Link}
                to="/login"
                variant="body2"
                color="primary"
                underline="hover"
                sx={{ minHeight: 44, display: "flex", alignItems: "center" }}
              >
                Already have an account?
              </MuiLink>
            </Box>

            <Button
              color="primary"
              variant="contained"
              fullWidth
              type="submit"
              disabled={loading}
              size="large"
              sx={{ py: 1.5, mt: { xs: 0.5, sm: 2 }, fontSize: { xs: "1rem", sm: "1.1rem" }, minHeight: 52 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : "Create Account"}
            </Button>
          </Box>
        </form>
      </Paper>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mt: { xs: 3, sm: 6 }, mb: 2, fontSize: { xs: "0.7rem", sm: "0.875rem" } }}
      >
        &copy; {new Date().getFullYear()} Talkify Inc. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Signup;
