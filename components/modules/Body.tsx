import { Code, Download, ExpandMore, PendingOutlined } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionGroup,
  AccordionSummary,
  Box,
  Divider,
  IconButton,
  Modal,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/joy";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import CustomEditor from "components/editor";
import Markdown from "marked-react";
import { MouseEventHandler, useState } from "react";
import type { Module, Release } from "utils/types";

interface ReleaseCardProps {
  release: Release;
  onBrowseCode(releaseId: string): Promise<void>;
}

function ReleaseCard({ release, onBrowseCode }: ReleaseCardProps) {
  const [editorLoading, setEditorLoading] = useState(false);

  const browseCode: MouseEventHandler = event => {
    event.stopPropagation();
    setEditorLoading(true);
    onBrowseCode(release.id).then(() => setEditorLoading(false));
  };

  return (
    <Accordion sx={{ my: 1 }}>
      <AccordionSummary indicator={<ExpandMore />}>
        <Stack
          display="flex"
          flexDirection="row"
          alignContent="center"
          alignItems="center"
          height="100%"
          width="100%"
        >
          <Typography mr={5} level="title-lg">
            v{release.releaseVersion}
          </Typography>
          <Typography mr={5}>for ct {release.modVersion}</Typography>
          <Box display="flex" flexDirection="row" mr={5}>
            <Download />
            <Typography>{release.downloads.toLocaleString()}</Typography>
          </Box>
          <Tooltip title="Browse Code">
            <IconButton onClick={browseCode}>
              {editorLoading ? <PendingOutlined /> : <Code />}
            </IconButton>
          </Tooltip>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Divider />
        <Markdown>{release.changelog}</Markdown>
      </AccordionDetails>
    </Accordion>
  );
}

interface BodyProps {
  module: Module;
  description?: string;
}

export default function Body({ module, description }: BodyProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [files, setFiles] = useState<Record<string, string>>({});

  async function onBrowseCode(releaseId: string): Promise<void> {
    // TODO: Remove the absproxy part, and ideally figure out how to put it there automatically if needed
    const res = await fetch(
      `/absproxy/3000/api/modules/${module.name}/releases/${releaseId}/scripts`,
      // `/api/modules/${module.name}/releases/${releaseId}/scripts`,
    );

    // TODO: Show error
    if (!res.ok) return;

    const reader = new ZipReader(new BlobReader(await res.blob()));
    const newFiles: Record<string, string> = {};

    for await (const entry of reader.getEntriesGenerator()) {
      if (!entry.directory && entry.getData) {
        const writer = new TextWriter();
        const path = entry.filename.startsWith(module.name)
          ? entry.filename.slice(module.name.length + 1)
          : entry.filename;
        newFiles[path] = await entry.getData(writer);
      }
    }

    await reader.close();

    setEditorOpen(true);
    setFiles(newFiles);
  }

  return (
    <>
      <Tabs variant="soft" sx={{ marginTop: 3 }}>
        <TabList>
          <Tab>Description</Tab>
          {module.releases.length > 0 && <Tab>{module.releases.length} Releases</Tab>}
        </TabList>
        <TabPanel value={0}>{description && <Markdown>{description}</Markdown>}</TabPanel>
        {module.releases.length > 0 && (
          <TabPanel value={1}>
            <AccordionGroup variant="plain" transition="0.2s ease">
              {module.releases.map(release => (
                <ReleaseCard key={release.id} release={release} onBrowseCode={onBrowseCode} />
              ))}
            </AccordionGroup>
          </TabPanel>
        )}
      </Tabs>
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        sx={{ width: "100%", height: "100%" }}
      >
        <Box
          display="flex"
          alignContent="center"
          alignItems="center"
          justifyContent="center"
          justifyItems="center"
          width="80%"
          height="80%"
          overflow="hidden"
          sx={{
            position: "absolute" as const,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            borderRadius: 10,
          }}
        >
          <CustomEditor projectName={module.name} files={files} />
        </Box>
      </Modal>
    </>
  );
}