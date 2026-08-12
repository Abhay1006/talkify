import { useState } from "react";
import { Link } from "react-router-dom";
import { useFormik } from "formik";
import * as yup from "yup";
import {
  Box, Typography, TextField, Button, Paper,
  InputAdornment, IconButton, CircularProgress, Link as MuiLink,
  ToggleButtonGroup, ToggleButton, LinearProgress
} from "@mui/material";
import {
  Person, Lock, Edit, Visibility, VisibilityOff, Wc
} from "@mui/icons-material";
import useSignup from "../../hooks/useSignup";

const validationSchema = yup.object({
  fullName: yup.string().required("Full Name is required"),
  username: yup.string().required("Username is required"),
  password: yup.string().min(6, "Password must be at least 6 characters").required("Password is required"),
  confirmPassword: yup.string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Confirm Password is required'),
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
  const [loading, signup] = useSignup();

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
    <Box sx={{
      minHeight: '100vh',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: { xs: 'flex-start', sm: 'center' },
      p: { xs: 2, sm: 2 },
      py: { xs: 2, sm: 4 },
      width: '100%',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <Paper elevation={0} sx={{
        p: { xs: 3, sm: 5 },
        width: '100%',
        maxWidth: { xs: '100%', sm: 600 },
        borderRadius: { xs: 3, sm: 4 },
      }}>
        <Box textAlign="center" mb={{ xs: 2.5, sm: 4 }}>
          <Typography variant="h3" fontWeight="bold" color="text.primary" gutterBottom sx={{ fontSize: { xs: '1.8rem', sm: '3rem' } }}>
            Talk<Typography component="span" variant="h3" color="primary" fontWeight="bold" sx={{ fontSize: 'inherit' }}>ify</Typography>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }}>
            Create your account to start talking.
          </Typography>
        </Box>

        <form onSubmit={formik.handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
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
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Edit /></InputAdornment>,
                }}
              />
              <TextField
                fullWidth
                id="username"
                name="username"
                label="Username"
                value={formik.values.username}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.touched.username && Boolean(formik.errors.username)}
                helperText={formik.touched.username && formik.errors.username}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Person /></InputAdornment>,
                }}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 3 } }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <TextField
                  fullWidth
                  id="password"
                  name="password"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.password && Boolean(formik.errors.password)}
                  helperText={formik.touched.password && formik.errors.password}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ minWidth: 44, minHeight: 44 }}>
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
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
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
                  helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Lock /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowConfirmPassword(!showConfirmPassword)} edge="end" sx={{ minWidth: 44, minHeight: 44 }}>
                          {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
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
                <ToggleButton value="male" sx={{ minHeight: 44 }}>Male</ToggleButton>
                <ToggleButton value="female" sx={{ minHeight: 44 }}>Female</ToggleButton>
              </ToggleButtonGroup>
              {formik.touched.gender && formik.errors.gender && (
                <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block', ml: 2 }}>
                  {formik.errors.gender}
                </Typography>
              )}
            </Box>

            <Box display="flex" justifyContent="flex-end">
              <MuiLink component={Link} to="/login" variant="body2" color="primary" underline="hover" sx={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
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
              sx={{ py: 1.5, mt: { xs: 0.5, sm: 2 }, fontSize: { xs: '1rem', sm: '1.1rem' }, minHeight: 52 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Create Account'}
            </Button>
          </Box>
        </form>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 3, sm: 6 }, mb: 2, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
        &copy; {new Date().getFullYear()} Talkify Inc. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Signup;
