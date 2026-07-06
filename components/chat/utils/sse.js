export function createSSEReader(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const queue = [];
  function feed(chunk) {
    buffer += chunk;
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      const dataLines = [];
      for (const line of rawEvent.split("\n")) {
        if (!line) continue;
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();else if (line.startsWith("data:")) dataLines.push(line.slice(5));
      }
      queue.push({
        event,
        data: dataLines.join("\n")
      });
    }
  }
  return {
    async *[Symbol.asyncIterator]() {
      while (true) {
        const {
          value,
          done
        } = await reader.read();
        if (done) break;
        feed(decoder.decode(value, {
          stream: true
        }));
        while (queue.length) yield queue.shift();
      }
      if (buffer) {
        feed("\n\n");
        while (queue.length) yield queue.shift();
      }
    }
  };
}