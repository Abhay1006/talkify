import { useState } from "react";
import { FiSearch } from "react-icons/fi";
import useConversation from "../../zustand/useConversations.js";
import { useSnackbar } from "notistack";
import { TextField, InputAdornment, Box } from "@mui/material";
import { apiClient } from "../../api/client.js";

const SearchInput = () => {
  const [search, setSearch] = useState("");
  const { setSelectedConversation } = useConversation();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!search) return;
    if (search.length < 3) {
      return enqueueSnackbar("Search term must be at least 3 characters long", { variant: 'error' });
    }

    setLoading(true);
    try {
      const data = await apiClient.get(`/api/users/search?q=${search}`);
      if (data.length > 0) {
        setSelectedConversation(data[0]);
        setSearch("");
      } else {
        enqueueSnackbar("No such user found!", { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(error.message || "Failed to search user", { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search usernames..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        disabled={loading}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <FiSearch size={18} />
            </InputAdornment>
          ),
          sx: {
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 3,
            '& fieldset': { border: 'none' },
            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
            '&.Mui-focused': { bgcolor: 'rgba(255, 255, 255, 0.06)' },
          }
        }}
      />
    </Box>
  );
};
export default SearchInput;
