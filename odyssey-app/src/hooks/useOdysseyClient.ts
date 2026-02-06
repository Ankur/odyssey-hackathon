import { useRef, useState, useCallback, useEffect } from 'react';
import { Odyssey } from '@odysseyml/odyssey';

export function useOdysseyClient() {
  const clientRef = useRef<Odyssey | null>(null);
  const [status, setStatus] = useState<string>('Disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  // Initialize client lazily
  const getClient = useCallback(() => {
    if (!clientRef.current) {
      const apiKey = import.meta.env.VITE_ODYSSEY_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_ODYSSEY_API_KEY not set in .env file');
      }
      clientRef.current = new Odyssey({ apiKey });
    }
    return clientRef.current;
  }, []);

  // Connect and return the output media stream
  const connect = useCallback(async (): Promise<MediaStream> => {
    const client = getClient();
    setStatus('Connecting...');
    const mediaStream = await client.connect();
    setIsConnected(true);
    setStatus('Connected');
    return mediaStream;
  }, [getClient]);

  // Start a stream with an image and prompt
  const startStream = useCallback(
    async (prompt: string, image: File) => {
      const client = getClient();
      setStatus('Generating...');
      await client.startStream({ prompt, image });
      setIsStreaming(true);
      setStatus('Streaming');
    },
    [getClient],
  );

  // Send a midstream interaction
  const interact = useCallback(
    async (prompt: string) => {
      const client = getClient();
      await client.interact({ prompt });
    },
    [getClient],
  );

  // End the current stream
  const endStream = useCallback(async () => {
    const client = getClient();
    await client.endStream();
    setIsStreaming(false);
    setStatus('Connected');
  }, [getClient]);

  // Disconnect completely
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
    setIsStreaming(false);
    setStatus('Disconnected');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  // Cleanup on page unload
  useEffect(() => {
    const handleUnload = () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return {
    status,
    isConnected,
    isStreaming,
    connect,
    startStream,
    interact,
    endStream,
    disconnect,
  };
}
