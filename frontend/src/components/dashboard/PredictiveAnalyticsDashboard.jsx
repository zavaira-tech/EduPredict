import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../services/api.js";

const modelTypes = [
  { value: "performance", label: "Student performance" },
  { value: "dropout", label: "Dropout risk" },
  { value: "course-demand", label: "Course demand" },
];
const riskColors = { "Low Risk": "#18a57f", "Medium Risk": "#e7a83e", "High Risk": "#d85f66" };

function modelTypeLabel(value) {
  return modelTypes.find((model) => model.value === value || model.value === value?.replace("courseDemand", "course-demand"))?.label || value;
}

function Metric({ label, value }) {
  return (
    <Paper className="kpi-card analytics-metric" elevation={0}>
      <div className="kpi-heading">{label}</div>
      <div className="kpi-value">{value ?? "—"}</div>
    </Paper>
  );
}

export function PredictionCard({ title, value, detail }) {
  return (
    <Paper className="analytics-panel" elevation={0}>
      <Typography className="panel-title">{title}</Typography>
      <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>{value ?? "—"}</Typography>
      {detail && <Typography color="text.secondary" sx={{ mt: 1 }}>{detail}</Typography>}
    </Paper>
  );
}

export function ModelMetricsCard({ title, status, metrics }) {
  const entries = metrics ? Object.entries(metrics).filter(([, value]) =>
    typeof value === "number" && Number.isFinite(value),
  ) : [];
  return (
    <Paper className="analytics-panel" elevation={0}>
      <Typography className="panel-title">{title}</Typography>
      {status !== "trained" ? (
        <Typography color="text.secondary" sx={{ mt: 1 }}>Not Trained — no evaluation metrics are available.</Typography>
      ) : (
        <div className="kpi-grid" style={{ marginTop: 16 }}>
          {entries.map(([key, value]) => (
            <Metric key={key} label={key.replace(/[A-Z]/g, (letter) => ` ${letter}`).toUpperCase()} value={value.toFixed(3)} />
          ))}
        </div>
      )}
    </Paper>
  );
}

export function ModelComparisonTable({ model }) {
  const candidates = model?.active?.candidates || [];
  const metricNames = candidates.length ? Object.keys(candidates[0].metrics || {}) : [];
  if (!model || model.status !== "trained") {
    return <Typography color="text.secondary">Not Trained — candidate comparison will appear after a successful training run.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Algorithm</TableCell>
          {metricNames.map((metric) => <TableCell key={metric} align="right">{metric}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>
        {candidates.map((candidate) => (
          <TableRow key={candidate.algorithm}>
            <TableCell>{candidate.algorithm}{candidate.algorithm === model.active.algorithm ? " (selected)" : ""}</TableCell>
            {metricNames.map((metric) => (
              <TableCell key={metric} align="right">
                {typeof candidate.metrics[metric] === "number" ? candidate.metrics[metric].toFixed(3) : "—"}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PredictionHistoryTable({ predictions, role }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [expandedId, setExpandedId] = useState("");
  const filtered = predictions.filter((item) => {
    const matchesType = type === "all" ||
      item.predictionType === type ||
      (type === "course-demand" && item.predictionType === "courseDemand");
    const haystack = [
      item.student?.studentId,
      item.student?.name,
      item.course?.courseCode,
      item.prediction,
      item.riskLevel,
      item.modelName,
    ].filter(Boolean).join(" ").toLowerCase();
    return matchesType && haystack.includes(query.trim().toLowerCase());
  });
  const visible = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const columnCount = role === "student" ? 6 : 7;

  if (!predictions.length) {
    return <Typography color="text.secondary">No predictions have been generated for the records you can access.</Typography>;
  }
  return (
    <>
      <div className="analytics-filters">
        <TextField
          label="Search predictions" size="small" value={query}
          onChange={(event) => { setQuery(event.target.value); setPage(0); }}
        />
        <TextField
          select label="Prediction type" size="small" value={type}
          onChange={(event) => { setType(event.target.value); setPage(0); }}
        >
          <MenuItem value="all">All predictions</MenuItem>
          {modelTypes.map((model) => <MenuItem key={model.value} value={model.value}>{model.label}</MenuItem>)}
        </TextField>
      </div>
      {filtered.length ? (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Generated</TableCell>
              {role !== "student" && <TableCell>Student</TableCell>}
              <TableCell>Course</TableCell>
              <TableCell>Prediction type</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Model</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((item) => (
              <>
                <TableRow key={item._id}>
                  <TableCell>
                    <IconButton
                      size="small"
                      aria-label={expandedId === item._id ? "Hide prediction details" : "Show prediction details"}
                      onClick={() => setExpandedId(expandedId === item._id ? "" : item._id)}
                    >
                      {expandedId === item._id ? "−" : "+"}
                    </IconButton>
                  </TableCell>
                  <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</TableCell>
                  {role !== "student" && <TableCell>{item.student?.studentId || item.student?.name || "—"}</TableCell>}
                  <TableCell>{item.course?.courseCode || "—"}</TableCell>
                  <TableCell>{modelTypeLabel(item.predictionType)}</TableCell>
                  <TableCell>
                    {item.riskLevel && <RiskBadge level={item.riskLevel} />}
                    {typeof item.predictedValue === "number" ? item.predictedValue.toFixed(1) : item.predictedValue || item.prediction}
                    {item.predictedGrade ? ` · ${item.predictedGrade}` : ""}
                  </TableCell>
                  <TableCell>{item.modelName ? `${item.modelName} ${item.modelVersion || ""}` : "—"}</TableCell>
                </TableRow>
                <TableRow key={`${item._id}-details`}>
                  <TableCell colSpan={columnCount} sx={{ py: 0 }}>
                    <Collapse in={expandedId === item._id} timeout="auto" unmountOnExit>
                      <div style={{ padding: 16 }}>
                        {item.inputFeatures && (
                          <>
                            <Typography variant="subtitle2">Academic features at prediction time</Typography>
                            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                              {Object.entries(item.inputFeatures)
                                .map(([name, value]) => `${name.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim()}: ${value ?? "Not available"}`)
                                .join(" · ")}
                            </Typography>
                          </>
                        )}
                        {item.explanation?.length > 0 && (
                          <>
                            <Typography variant="subtitle2" sx={{ mt: 1 }}>Potential risk indicators (not causal)</Typography>
                            <Typography color="text.secondary">
                              {item.explanation.map((factor) => factor.indicator).filter(Boolean).join("; ")}
                            </Typography>
                          </>
                        )}
                        {(item.recommendations || []).length > 0 && (
                          <>
                            <Typography variant="subtitle2" sx={{ mt: 1 }}>Supportive recommendations</Typography>
                            <Typography color="text.secondary">{item.recommendations.join(" · ")}</Typography>
                          </>
                        )}
                        {item.details?.disclaimer && (
                          <Typography color="text.secondary" variant="caption">{item.details.disclaimer}</Typography>
                        )}
                      </div>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
      ) : <Typography color="text.secondary">No prediction records match these filters.</Typography>}
      <TablePagination
        component="div"
        count={filtered.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_event, nextPage) => setPage(nextPage)}
        onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </>
  );
}

export function RiskBadge({ level }) {
  const color = level === "High Risk" ? "error" : level === "Medium Risk" ? "warning" : "success";
  return <Chip size="small" label={level} color={color} sx={{ mr: 1 }} />;
}

export function PerformancePredictionChart({ actualRecords, predictions }) {
  const data = [
    ...actualRecords
      .filter((record) => Number.isFinite(record.finalScore))
      .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
      .map((record, index) => ({ period: `History ${index + 1}`, historical: record.finalScore })),
    ...predictions.map((item, index) => ({ period: `Prediction ${index + 1}`, predicted: item.predictedValue })),
  ];
  return data.length ? (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="predicted" name="Predicted final score" stroke="#356ae6" />
        <Line type="monotone" dataKey="historical" name="Historical final score" stroke="#14a991" />
      </LineChart>
    </ResponsiveContainer>
  ) : <Typography color="text.secondary">No performance predictions are available yet.</Typography>;
}

export function DropoutRiskChart({ predictions }) {
  const data = ["Low Risk", "Medium Risk", "High Risk"].map((name) => ({
    name,
    value: predictions.filter((item) => item.riskLevel === name).length,
  })).filter((item) => item.value > 0);
  return data.length ? (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={85} label>
          {data.map((item) => <Cell key={item.name} fill={riskColors[item.name]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  ) : <Typography color="text.secondary">No dropout predictions are available yet.</Typography>;
}

export function CourseDemandChart({ predictions }) {
  const data = predictions.map((item, index) => ({
    forecast: `${index + 1}`,
    enrollment: item.predictedValue,
  }));
  return data.length ? (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="forecast" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="enrollment" name="Predicted enrollment" fill="#14a991" />
      </BarChart>
    </ResponsiveContainer>
  ) : <Typography color="text.secondary">No course-demand forecasts are available yet.</Typography>;
}

export function FeatureImportanceChart({ features }) {
  const data = (features || [])
    .filter((item) => Number.isFinite(item.importance))
    .sort((left, right) => Math.abs(right.importance) - Math.abs(left.importance))
    .slice(0, 8)
    .map((item) => ({ ...item, feature: item.feature.replace(/[A-Z]/g, (letter) => ` ${letter}`).trim() }));
  return data.length ? (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" />
        <YAxis type="category" dataKey="feature" width={155} />
        <Tooltip />
        <Bar dataKey="importance" name="Permutation importance" fill="#356ae6" />
      </BarChart>
    </ResponsiveContainer>
  ) : <Typography color="text.secondary">No feature-importance values are available.</Typography>;
}

export function ModelTrainingHistory({ evaluation }) {
  const records = Object.values(evaluation || {}).flatMap((model) =>
    (model.history || []).map((item) => ({ ...item })),
  ).sort((left, right) => new Date(right.trainedAt) - new Date(left.trainedAt));
  if (!records.length) {
    return <Typography color="text.secondary">No models have been trained.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Model</TableCell>
          <TableCell>Version</TableCell>
          <TableCell>Algorithm</TableCell>
          <TableCell>Trained</TableCell>
          <TableCell align="right">Dataset size</TableCell>
          <TableCell>Selection rule</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {records.map((item) => (
          <TableRow key={item.modelId}>
            <TableCell>{item.modelName}</TableCell>
            <TableCell>{item.modelVersion}</TableCell>
            <TableCell>{item.algorithm}</TableCell>
            <TableCell>{new Date(item.trainedAt).toLocaleString()}</TableCell>
            <TableCell align="right">{item.datasetSize}</TableCell>
            <TableCell>{item.selectionRule}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ChartPanel({ title, children }) {
  return (
    <Paper className="analytics-panel" elevation={0}>
      <Typography className="panel-title">{title}</Typography>
      {children}
    </Paper>
  );
}

function modelData(evaluation, key) {
  return evaluation?.[key] || { status: "not-trained", active: null, history: [] };
}

export default function PredictiveAnalyticsDashboard({ user }) {
  const canGenerate = ["admin", "teacher", "student"].includes(user?.role);
  const canTrain = user?.role === "admin";
  const canViewMetrics = ["admin", "analyst"].includes(user?.role);
  const [evaluation, setEvaluation] = useState(null);
  const [modelStatus, setModelStatus] = useState({});
  const [predictions, setPredictions] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [academicRecords, setAcademicRecords] = useState([]);
  const [predictionType, setPredictionType] = useState("performance");
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    const requests = [api.get("/ml/predictions"), api.get("/ml/status")];
    if (canViewMetrics) requests.push(api.get("/ml/evaluation"));
    if (canGenerate) {
      requests.push(api.get("/students"));
      requests.push(api.get("/courses"));
      requests.push(api.get("/performance"));
    }
    const results = await Promise.allSettled(requests);
    if (results[0].status === "fulfilled") {
      setPredictions(results[0].value.data.data || []);
    } else {
      setError(results[0].reason.response?.data?.message || "Unable to load prediction history.");
    }
    if (results[1].status === "fulfilled") {
      setModelStatus(Object.fromEntries((results[1].value.data.data || []).map((model) => [model.modelType, model])));
    } else {
      setError((current) => current || results[1].reason.response?.data?.message || "Unable to load model status.");
    }
    let resultIndex = 2;
    if (canViewMetrics) {
      const result = results[resultIndex++];
      if (result.status === "fulfilled") setEvaluation(result.value.data.data);
      else setError((current) => current || result.reason.response?.data?.message || "Unable to load model evaluation.");
    }
    if (canGenerate) {
      const studentResult = results[resultIndex++];
      const courseResult = results[resultIndex++];
      const performanceResult = results[resultIndex];
      if (studentResult.status === "fulfilled") setStudents(studentResult.value.data.data || []);
      else setError((current) => current || studentResult.reason.response?.data?.message || "Unable to load authorized student records.");
      if (courseResult.status === "fulfilled") setCourses(courseResult.value.data.data || []);
      else setError((current) => current || courseResult.reason.response?.data?.message || "Unable to load authorized courses.");
      if (performanceResult.status === "fulfilled") setAcademicRecords(performanceResult.value.data.data || []);
      else setError((current) => current || performanceResult.reason.response?.data?.message || "Unable to load historical performance.");
    }
    setLoading(false);
  }, [canGenerate, canViewMetrics]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedStudent = students.find((student) => student._id === studentId);
  const selectedCourse = courses.find((course) => course._id === courseId);
  const eligiblePerformanceRecords = useMemo(() => academicRecords.filter((record) =>
    String(record.student?._id || record.student) === studentId &&
    String(record.course?._id || record.course) === courseId,
  ), [academicRecords, courseId, studentId]);

  const train = async (type) => {
    setBusy(`train:${type}`);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/ml/train/${type}`);
      setNotice(`${data.data.modelName} ${data.data.modelVersion} trained on ${data.data.datasetSize} historical records.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Model training failed.");
    } finally {
      setBusy("");
    }
  };

  const generate = async () => {
    setBusy("predict");
    setError("");
    setNotice("");
    try {
      const request = predictionType === "course-demand"
        ? { courseId }
        : { studentId, ...(predictionType === "performance" ? { courseId } : {}) };
      const { data } = await api.post(`/ml/predict/${predictionType}`, request);
      const result = data.data;
      const label = predictionType === "performance"
        ? `Predicted final score: ${result.predictedFinalScore} (${result.predictedGrade})`
        : predictionType === "dropout"
          ? `${result.riskLevel} · estimated probability ${(result.riskProbability * 100).toFixed(1)}%`
          : `Predicted enrollment: ${result.predictedEnrollment} · ${result.demandCategory}`;
      setNotice(`${label}. Estimates are not guarantees or proof of causation.`);
      await loadData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to generate a prediction.");
    } finally {
      setBusy("");
    }
  };

  const performanceModel = modelData(evaluation, "performance");
  const dropoutModel = modelData(evaluation, "dropout");
  const demandModel = modelData(evaluation, "course-demand");
  const performanceStatus = modelStatus.performance;
  const dropoutStatus = modelStatus.dropout;
  const demandStatus = modelStatus["course-demand"];
  const riskDistribution = ["Low Risk", "Medium Risk", "High Risk"].map((name) => ({
    name,
    value: predictions.filter((item) => item.predictionType === "dropout" && item.riskLevel === name).length,
  })).filter((item) => item.value > 0);
  const performancePredictions = predictions.filter((item) =>
    item.predictionType === "performance" &&
    typeof item.predictedValue === "number" &&
    item.student?._id === studentId &&
    item.course?._id === courseId,
  ).slice(0, 10).reverse();
  const demandPredictions = predictions.filter((item) =>
    item.predictionType === "courseDemand" && typeof item.predictedValue === "number",
  ).slice(0, 10).reverse();

  if (loading) return <div className="loading-view"><CircularProgress size={26} /></div>;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Insights <span>/</span> Predictive analytics</div>
          <h1 className="greeting">Predictive analytics</h1>
          <p className="page-description">Model estimates trained only from validated historical academic records.</p>
        </div>
        <Button variant="outlined" onClick={loadData}>Refresh</Button>
      </div>

      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}
      <Alert severity="info">
        Predictions support academic guidance; they are estimates, not certainties or causal explanations. No student is automatically penalized based on a model output.
      </Alert>

      {canGenerate && (
        <Paper className="analytics-filters" elevation={0}>
          <TextField
            select label="Prediction" size="small" value={predictionType}
            onChange={(event) => setPredictionType(event.target.value)}
          >
            {modelTypes.map((item) => <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>)}
          </TextField>
          {predictionType !== "course-demand" && (
            <TextField
              select label="Student" size="small" value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
            >
              {students.map((student) => (
                <MenuItem key={student._id} value={student._id}>{student.studentId} · {student.name}</MenuItem>
              ))}
            </TextField>
          )}
          {(predictionType === "performance" || predictionType === "course-demand") && (
            <TextField
              select label="Course" size="small" value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
            >
              {courses.map((course) => (
                <MenuItem key={course._id} value={course._id}>{course.courseCode} · {course.courseName}</MenuItem>
              ))}
            </TextField>
          )}
          <Button
            variant="contained"
            disabled={Boolean(busy) || !((predictionType === "course-demand" && courseId) ||
              (predictionType === "dropout" && studentId) ||
              (predictionType === "performance" && studentId && courseId && eligiblePerformanceRecords.length > 0))}
            onClick={generate}
          >
            {busy === "predict" ? "Generating..." : "Generate prediction"}
          </Button>
          {predictionType === "performance" && studentId && courseId && eligiblePerformanceRecords.length === 0 && (
            <Typography color="text.secondary" variant="body2">
              No performance record is available for {selectedStudent?.studentId || "this student"} in {selectedCourse?.courseCode || "this course"}.
            </Typography>
          )}
        </Paper>
      )}

      <div className="kpi-grid">
        <Metric label="Performance model" value={performanceStatus?.status === "trained" ? performanceStatus.algorithm || "Ready" : "Not Trained"} />
        <Metric label="Dropout model" value={dropoutStatus?.status === "trained" ? dropoutStatus.algorithm || "Ready" : "Not Trained"} />
        <Metric label="Course-demand model" value={demandStatus?.status === "trained" ? demandStatus.algorithm || "Ready" : "Not Trained"} />
      </div>

      {canViewMetrics && (
        <>
          <div className="analytics-grid">
            <ModelMetricsCard
              title="Performance evaluation"
              status={performanceModel.status}
              metrics={performanceModel.active?.metrics}
            />
            <ModelMetricsCard
              title="Dropout evaluation"
              status={dropoutModel.status}
              metrics={dropoutModel.active?.metrics}
            />
            <ModelMetricsCard
              title="Course-demand evaluation"
              status={demandModel.status}
              metrics={demandModel.active?.metrics}
            />
          </div>
        </>
      )}

      {canTrain && (
        <ChartPanel title="Controlled model training">
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Training uses real completed academic records selected by the backend. A model is activated only after its holdout evaluation succeeds.
          </Typography>
          <div className="analytics-actions">
            {modelTypes.map((model) => (
              <Button
                key={model.value}
                variant="outlined"
                disabled={Boolean(busy)}
                onClick={() => train(model.value)}
              >
                {busy === `train:${model.value}` ? "Training..." : `Train ${model.label}`}
              </Button>
            ))}
          </div>
        </ChartPanel>
      )}

      {canViewMetrics && (
        <div className="analytics-grid">
          {[["Performance model comparison", performanceModel], ["Dropout model comparison", dropoutModel], ["Course-demand model comparison", demandModel]].map(([title, model]) => (
            <ChartPanel key={title} title={title}><ModelComparisonTable model={model} /></ChartPanel>
          ))}
        </div>
      )}

      <div className="analytics-grid">
        <ChartPanel title="Predicted versus historical performance">
          {performancePredictions.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={[
                ...eligiblePerformanceRecords
                  .filter((record) => Number.isFinite(record.finalScore))
                  .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
                  .map((record, index) => ({
                    assessment: `History ${index + 1}`,
                    historical: record.finalScore,
                  })),
                ...performancePredictions.map((item, index) => ({
                  assessment: `Prediction ${index + 1}`,
                  predicted: item.predictedValue,
                })),
              ]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="assessment" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="predicted" name="Predicted final score" stroke="#356ae6" />
                <Line type="monotone" dataKey="historical" name="Historical final score" stroke="#14a991" />
              </LineChart>
            </ResponsiveContainer>
          ) : <Typography color="text.secondary">No performance predictions are available yet.</Typography>}
        </ChartPanel>

        <ChartPanel title="Dropout-risk distribution">
          {riskDistribution.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" nameKey="name" outerRadius={85} label>
                  {riskDistribution.map((item) => <Cell key={item.name} fill={riskColors[item.name]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <Typography color="text.secondary">No dropout predictions are available yet.</Typography>}
        </ChartPanel>

        <ChartPanel title="Course-demand forecasts">
          {demandPredictions.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={demandPredictions.map((item, index) => ({
                forecast: `${index + 1}`,
                enrollment: item.predictedValue,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="forecast" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="enrollment" name="Predicted enrollment" fill="#14a991" />
              </BarChart>
            </ResponsiveContainer>
          ) : <Typography color="text.secondary">No course-demand forecasts are available yet.</Typography>}
        </ChartPanel>
      </div>

      <ChartPanel title="Prediction history">
        <PredictionHistoryTable predictions={predictions} role={user?.role} />
      </ChartPanel>

      {predictions.some((item) => item.explanation?.length) && (
        <ChartPanel title="Supportive dropout-risk indicators">
          {predictions.filter((item) => item.predictionType === "dropout" && item.explanation?.length).slice(0, 10).map((item) => (
            <div key={item._id} style={{ marginBottom: 12 }}>
              <Typography variant="subtitle2">
                {item.student?.studentId || "Student"} · {item.riskLevel || "Risk estimate"}
              </Typography>
              <Typography color="text.secondary">
                {item.explanation.map((factor) => factor.indicator).filter(Boolean).join("; ")}
              </Typography>
              {(item.recommendations || []).map((recommendation) => (
                <Typography key={recommendation} color="text.secondary" variant="body2">• {recommendation}</Typography>
              ))}
            </div>
          ))}
        </ChartPanel>
      )}
    </div>
  );
}
