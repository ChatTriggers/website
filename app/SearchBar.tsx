"use client";

import { QuestionMark } from "@mui/icons-material";
import { Box, Chip, ChipDelete, IconButton, Input, Stack, Tooltip, Typography } from "@mui/joy";
import type { SxProps, Theme } from "@mui/material/styles";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { switchMode } from "utils/layout";

const helpText = (
  <Typography level="body-sm" sx={{ color: "#ddd" }}>
    Searches module names, descriptions, and authors. Use <br />
    <code style={{ backgroundColor: "#555" }}>name:&lt;value&gt;</code> to filter by name,{" "}
    <code style={{ backgroundColor: "#555" }}>author:&lt;value&gt;</code>
    <br />
    to filter for author, and <code style={{ backgroundColor: "#555" }}>tag:&lt;value&gt;</code> to
    filter by tags.
  </Typography>
);

interface Props {
  sx?: SxProps<Theme>;
}

interface Term {
  name: string;
  value: string;
}

interface TermWithNode extends Term {
  node: React.ReactNode;
}

const termOptions = ["name", "owner", "description", "tag"].map(tag => {
  return [tag, new RegExp(`(?:^| )(?<tag>${tag}:\\w+) `)] as const;
});

function splitSearchIntoTerms(input: string): { terms: Term[]; remaining: string } {
  const terms = [];
  let remaining = input;

  for (const option of termOptions) {
    const match = option[1].exec(remaining);
    if (!match) continue;

    const [name, value] = match[1].split(":");
    terms.push({ name, value });

    const firstIndex = remaining.indexOf(match[0]);
    const lastIndex = match.index + match[0].length;
    remaining = remaining.substring(0, firstIndex) + remaining.substring(lastIndex);
  }

  return { terms, remaining };
}

export default function SearchBar({ sx = [] }: Props) {
  const makeTermNode = (term: Term): TermWithNode => ({
    ...term,
    node: (
      <Chip
        key={term.name + term.value}
        variant="solid"
        sx={{ backgroundColor: theme => theme.vars.palette.neutral[500] }}
        endDecorator={
          <ChipDelete
            sx={{ ml: 0, backgroundColor: theme => theme.vars.palette.neutral[600] }}
            variant="outlined"
            onDelete={() => handleDeleteChip(term)}
          />
        }
      >
        {term.name}:{term.value}
      </Chip>
    ),
  });

  const router = useRouter();
  const query = useSearchParams();

  const getTermNodes = (): TermWithNode[] => {
    return Array.from(query)
      .filter(([name]) => termOptions.find(o => o[0] === name))
      .map(([name, value]) => ({ name, value }))
      .map(makeTermNode);
  };

  const [value, setValue] = useState(query.get("q"));
  const [terms, setTerms] = useState<TermWithNode[]>(getTermNodes());

  useEffect(() => {
    setValue(query.get("q"));
    setTerms(getTermNodes());
  }, [query]);

  const handleDeleteChip = ({ name, value }: Term): void => {
    setTerms(terms.filter(c => c.name !== name || c.value !== value));
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    const { terms: newTerms, remaining } = splitSearchIntoTerms(value);
    if (newTerms.length) {
      setTerms([...terms, ...newTerms.map(makeTermNode)]);
    }
    setValue(remaining);
  };

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "Enter") handleSubmit();
  };

  const handleSubmit = (): void => {
    const queryParams = new URLSearchParams();
    for (const { name, value } of terms) {
      queryParams.set(name, value.trim());
    }

    const trimmed = value?.trim();
    if (trimmed?.length) {
      queryParams.set("q", trimmed);
    }

    router.replace(`/modules?${queryParams}`);
  };

  const renderedChips = (
    <Stack direction="row" spacing={1}>
      {terms.map(c => c.node)}
    </Stack>
  );

  return (
    <Box sx={[...(Array.isArray(sx) ? sx : [sx]), { width: { mobile: "100%", tablet: "auto" } }]}>
      <Input
        placeholder="Search"
        startDecorator={renderedChips}
        endDecorator={
          <Tooltip title={helpText} arrow>
            <IconButton sx={{ mr: 0 /* this gives it more margin for some reason? */ }}>
              <QuestionMark />
            </IconButton>
          </Tooltip>
        }
        value={value ?? undefined}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        sx={theme => ({
          "--Input-radius": "43px",
          "--Input-focusedInset": "var(--any, )",
          "--Input-focusedThickness": "4px",
          "&:focus-within::before": {
            boxShadow: `0px 0px 0px 4px ${theme.vars.palette.secondary[600]}`,
          },
          "&::before": {
            transition: "box-shadow .15s ease-in-out",
            p: 0,
            m: 0,
          },
          minHeight: 32,
          backgroundColor: theme.vars.palette.neutral[switchMode(700, 100)],
          border: "none",
          boxShadow: "none",
        })}
      />
    </Box>
  );
}