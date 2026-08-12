import { Box, Skeleton } from "@mui/material";

const MessageSkeleton = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, py: 1 }}>
      {/* Incoming message skeleton */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Skeleton variant="rounded" width={36} height={36} sx={{ flexShrink: 0, bgcolor: 'rgba(255,255,255,0.05)' }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Skeleton variant="rounded" width={160} height={16} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
          <Skeleton variant="rounded" width={120} height={16} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
        </Box>
      </Box>
      {/* Outgoing message skeleton */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
          <Skeleton variant="rounded" width={140} height={16} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
        </Box>
        <Skeleton variant="rounded" width={36} height={36} sx={{ flexShrink: 0, bgcolor: 'rgba(255,255,255,0.05)' }} />
      </Box>
    </Box>
  );
};
export default MessageSkeleton;
