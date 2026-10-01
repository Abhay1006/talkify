import { useState } from "react";
import { useSnackbar } from "notistack";
import {
  TextField,
  InputAdornment,
  Box,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  ClickAwayListener,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { Close, Search } from "@mui/icons-material";
import useConversation from "../../zustand/useConversations.js";
import { apiClient } from "../../api/client.js";

// Mirrors SEARCH_MIN_LENGTH in backend/controllers/user.controller.js.
const MIN_LENGTH = 3;

const SearchInput = () => {
  const [search, setSearch] = useState("");
  // null = no search run yet; [] = searched, nothing found.
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const setSelectedConversation = useConversation((state) => state.setSelectedConversation);
  const { enqueueSnackbar } = useSnackbar();

  const closeResults = () => setResults(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    if (term.length < MIN_LENGTH) {
      enqueueSnackbar(`Search term must be at least ${MIN_LENGTH} characters long`, { variant: "error" });
      return;
    }

    setLoading(true);
    try {
      // Encoded: a raw "&", "#" or "+" in the term used to break the query.
      const data = await apiClient.get(`/api/users/search?q=${encodeURIComponent(term)}`);
      setResults(data);
    } catch (error) {
      enqueueSnackbar(error.message || "Failed to search users", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Every match is listed to choose from. Search used to open the first match
  // silently, so with a prefix search you could not reach anyone else.
  const choose = (user) => {
    setSelectedConversation(user);
    setSearch("");
    closeResults();
  };

  return (
    <ClickAwayListener onClickAway={closeResults}>
      <Box
        component="form"
        role="search"
        onSubmit={handleSubmit}
        onKeyDown={(e) => e.key === "Escape" && closeResults()}
        sx={{ position: "relative" }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search usernames..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="small"
          slotProps={{
            htmlInput: { "aria-label": "Search usernames", enterKeyHint: "search" },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  {loading ? (
                    <CircularProgress size={18} aria-label="Searching" />
                  ) : (
                    <Search sx={{ fontSize: 20 }} />
                  )}
                </InputAdornment>
              ),
              endAdornment: search ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => {
                      setSearch("");
                      closeResults();
                    }}
                  >
                    <Close sx={{ fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: {
                bgcolor: "rgba(255, 255, 255, 0.03)",
                borderRadius: 3,
                "& fieldset": { border: "none" },
                "&:hover": { bgcolor: "rgba(255, 255, 255, 0.06)" },
                "&.Mui-focused": { bgcolor: "rgba(255, 255, 255, 0.06)" },
              },
            },
          }}
        />

        {results && (
          <Paper
            elevation={8}
            sx={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              mt: 1,
              zIndex: 10,
              maxHeight: 320,
              overflowY: "auto",
              bgcolor: "background.default",
            }}
          >
            {results.length === 0 ? (
              <Box sx={{ p: 2, color: "text.secondary", fontSize: "0.875rem" }} role="status">
                No users found
              </Box>
            ) : (
              <List dense aria-label="Search results">
                {results.map((user) => (
                  <ListItemButton key={user._id} onClick={() => choose(user)}>
                    <ListItemAvatar>
                      <Avatar src={user.profilePic} alt="" variant="rounded" />
                    </ListItemAvatar>
                    <ListItemText primary={user.fullName} secondary={`@${user.username}`} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Paper>
        )}
      </Box>
    </ClickAwayListener>
  );
};
export default SearchInput;
