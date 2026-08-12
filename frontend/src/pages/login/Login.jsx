import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormik } from 'formik';
import * as yup from 'yup';
import { 
  Box, Typography, TextField, Button, Paper, 
  InputAdornment, IconButton, CircularProgress, Link as MuiLink
} from '@mui/material';
import { Person, Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import useLogin from '../../hooks/useLogin';

const validationSchema = yup.object({
  username: yup.string().required('Username is required'),
  password: yup.string().min(6, 'Password should be of minimum 6 characters length').required('Password is required'),
});

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const { loading, login } = useLogin();

  const formik = useFormik({
    initialValues: {
      username: '',
      password: '',
    },
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      await login(values.username, values.password);
    },
  });

  return (
    <Box sx={{
      minHeight: '100vh',
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: { xs: 2, sm: 2 },
      width: '100%',
    }}>
      <Paper elevation={0} sx={{
        p: { xs: 3, sm: 6 },
        width: '100%',
        maxWidth: { xs: '100%', sm: 450 },
        borderRadius: { xs: 3, sm: 4 },
        mx: { xs: 1, sm: 0 },
      }}>
        <Box textAlign="center" mb={{ xs: 3, sm: 4 }}>
          <Typography variant="h3" fontWeight="bold" color="text.primary" gutterBottom sx={{ fontSize: { xs: '2rem', sm: '3rem' } }}>
            Talk<Typography component="span" variant="h3" color="primary" fontWeight="bold" sx={{ fontSize: 'inherit' }}>ify</Typography>
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: { xs: '0.85rem', sm: '1rem' } }}>
            Welcome back! Please enter your details.
          </Typography>
        </Box>

        <form onSubmit={formik.handleSubmit}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2.5, sm: 3 } }}>
            <TextField
              fullWidth
              id="username"
              name="username"
              label="Username"
              placeholder="Enter your username"
              value={formik.values.username}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.username && Boolean(formik.errors.username)}
              helperText={formik.touched.username && formik.errors.username}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              id="password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={formik.touched.password && formik.errors.password}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ minWidth: 44, minHeight: 44 }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            <Box display="flex" justifyContent="flex-end">
              <MuiLink component={Link} to="/signup" variant="body2" color="primary" underline="hover" sx={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
                {"Don't"} have an account?
              </MuiLink>
            </Box>

            <Button 
              color="primary" 
              variant="contained" 
              fullWidth 
              type="submit" 
              disabled={loading}
              size="large"
              sx={{ py: 1.5, mt: { xs: 1, sm: 2 }, fontSize: { xs: '1rem', sm: '1.1rem' }, minHeight: 52 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </form>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: { xs: 3, sm: 6 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
        &copy; {new Date().getFullYear()} Talkify Inc. All rights reserved.
      </Typography>
    </Box>
  );
};

export default Login;
