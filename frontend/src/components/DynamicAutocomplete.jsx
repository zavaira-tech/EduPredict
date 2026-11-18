import { useEffect, useRef, useState } from "react";
import { Alert, Autocomplete, CircularProgress, TextField } from "@mui/material";
import api from "../services/api.js";

const pageSize = 50;

export default function DynamicAutocomplete({
  endpoint,
  label,
  value,
  onChange,
  params = {},
  valueField = "_id",
  getOptionLabel,
  selectedOption = null,
  required = false,
  disabled = false,
  freeSolo = false,
  freeSoloWhenEmpty = false,
  helperText,
}) {
  const [options, setOptions] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalOptions, setTotalOptions] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);
  const requestId = useRef(0);
  const paramsKey = JSON.stringify(params);
  const optionLabel = getOptionLabel || ((option) => String(option?.label || option?.[valueField] || ""));

  useEffect(() => {
    let active = true;
    const request = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      setPage(1);
      try {
        const { data } = await api.get(endpoint, {
          params: {
            ...JSON.parse(paramsKey),
            search: inputValue.trim() || undefined,
            page: 1,
            limit: pageSize,
            includeId: value || undefined,
          },
        });
        if (!active || request !== requestId.current) return;
        const loadedOptions = data.data || [];
        setOptions(loadedOptions);
        setTotalOptions(data.pagination?.total || 0);
        setHasLoaded(true);
        setHasMore((data.pagination?.page || 1) < (data.pagination?.pages || 1));
      } catch (requestError) {
        if (!active || request !== requestId.current) return;
        setOptions([]);
        setHasMore(false);
        setHasLoaded(true);
        setError(requestError.response?.data?.message || `Unable to load ${label.toLowerCase()} options.`);
      } finally {
        if (active && request === requestId.current) setLoading(false);
      }
    }, inputValue ? 250 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [endpoint, inputValue, label, paramsKey, value]);

  const loadNextPage = async () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    const request = ++requestId.current;
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, {
        params: {
          ...JSON.parse(paramsKey),
          search: inputValue.trim() || undefined,
          page: nextPage,
          limit: pageSize,
          includeId: value || undefined,
        },
      });
      if (request !== requestId.current) return;
      setOptions((current) => [...current, ...(data.data || [])]);
      setPage(nextPage);
      setHasMore((data.pagination?.page || nextPage) < (data.pagination?.pages || nextPage));
    } catch (requestError) {
      if (request !== requestId.current) return;
      setError(requestError.response?.data?.message || `Unable to load ${label.toLowerCase()} options.`);
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  };

  const selected = options.find((option) => String(option?.[valueField]) === String(value)) ||
    (selectedOption && typeof selectedOption === "object" ? selectedOption : null);

  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      <Autocomplete
        fullWidth
        options={options}
        value={selected}
        inputValue={inputValue}
        loading={loading}
        disabled={disabled}
        freeSolo={freeSolo || (
          freeSoloWhenEmpty && hasLoaded && totalOptions === 0 && !inputValue && !error
        )}
        filterOptions={(available) => available}
        getOptionLabel={(option) => typeof option === "string" ? option : optionLabel(option)}
        isOptionEqualToValue={(option, selectedOption) =>
          String(option?.[valueField]) === String(selectedOption?.[valueField])
        }
        noOptionsText={loading ? "Loading..." : freeSoloWhenEmpty && totalOptions === 0
          ? `No ${label.toLowerCase()} records yet`
          : `No ${label.toLowerCase()} found`}
        onInputChange={(_, nextInput, reason) => {
          if (reason === "input" || reason === "clear" || reason === "reset") setInputValue(nextInput);
        }}
        onChange={(_, option) => {
          if (typeof option === "string") {
            onChange(option, option);
            return;
          }
          onChange(option?.[valueField] ?? "", option || null);
        }}
        ListboxProps={{
          onScroll: (event) => {
            const listbox = event.currentTarget;
            if (listbox.scrollTop + listbox.clientHeight >= listbox.scrollHeight - 24) {
              loadNextPage();
            }
          },
        }}
        renderInput={(autocompleteParams) => (
          <TextField
            {...autocompleteParams}
            label={label}
            required={required}
            error={Boolean(error)}
            helperText={error || (
              freeSoloWhenEmpty && hasLoaded && totalOptions === 0 && !inputValue
                ? `No existing ${label.toLowerCase()} records; enter the first value.`
                : helperText
            )}
            InputProps={{
              ...autocompleteParams.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={18} />}
                  {autocompleteParams.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    </>
  );
}
