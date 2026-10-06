# Credit Risk Assessment with XGBoost, SHAP & MLFlow

Predicts whether a loan applicant will default, explains why, and serves the result through a live web app.

**Live demo:** https://cardloans.onrender.com
(Free Render instance, so the first load may take up to a minute.)

## Demo

https://github.com/user-attachments/assets/fb0f6562-2889-4f29-9611-3e04a38b4338


A short walkthrough of the cardloans web app.

## Key results

The final model was tested on 6,305 loans it never saw during training.

| Metric | Baseline (Logistic Regression) | Final (XGBoost) | Improvement |
|---|---|---|---|
| Accuracy | 82% | **94%** | +12 points |
| Precision | 56% | **98%** | +42 points |
| F1 score | 0.65 | **0.83** | +28% |
| ROC-AUC (5-fold CV) | 0.87 | **0.95** | +9% |

- When the model flags an applicant as high risk, it is correct **98%** of the time.
- False alarms dropped from **44%** of flagged applicants to **2%**.
- Tuning the decision threshold alone raised precision from 82% to 98%.
- Recall is 72% (the baseline was 79%). This was a deliberate tradeoff, covered below.

## What we did

1. **Explored and cleaned 32,581 loan records.** About 22% were defaults. We removed 165 duplicates and impossible values such as ages above 100 and 123 years of employment, leaving 31,522 clean rows.
2. **Handled class imbalance.** There were 3.6 good loans for every default, so defaults were weighted 3.6x during training.
3. **Built preprocessing pipelines.** Median imputation for numbers, one hot encoding for categories, all inside a scikit-learn Pipeline so training and serving use the same steps.
4. **Compared models** with 5-fold stratified cross validation. XGBoost beat Logistic Regression on every metric.
5. **Tuned hyperparameters** with a randomized search over 150 combinations (750 model fits).
6. **Optimized the decision threshold.** Moved it from the default 0.50 to 0.76, the point with the best F1 score.
7. **Calibrated probabilities** with sigmoid calibration so a score of 0.30 really means about a 30% chance of default.
8. **Explained predictions with SHAP**, then **served the model with FastAPI** and **deployed it on Render**.

## MLflow: experiment tracking

Every model run was logged to MLflow under the experiment `Credit_Risk_Classification`, including:

- Logistic Regression baseline
- XGBoost baseline
- XGBoost with randomized search
- Calibrated XGBoost

Each run stores its parameters and metrics, which made it easy to compare models side by side and choose the final one. The run history is saved in `mlflow.db`.

## SHAP: explaining the model

A credit decision should come with a reason. We used SHAP's TreeExplainer on the XGBoost model to build:

- **Summary plot:** which features drive risk across all applicants
- **Waterfall plot:** how each feature pushed a single applicant's risk up or down

Both plots are in `Credit_Risk.ipynb`.

## FastAPI: serving predictions

`main.py` loads the model and threshold once at startup and exposes two routes:

| Route | Purpose |
|---|---|
| `POST /predict` | Takes 11 applicant fields and returns the default probability and a risk label |
| `GET /` | Serves the web form in `static/` |

Pydantic validates every request before it reaches the model.

**Example request**

```json
{
  "person_age": 30,
  "person_income": 50000,
  "person_home_ownership": "RENT",
  "person_emp_length": 3,
  "loan_intent": "EDUCATION",
  "loan_grade": "B",
  "loan_amnt": 10000,
  "loan_int_rate": 11,
  "loan_percent_income": 0.2,
  "cb_person_default_on_file": "N",
  "cb_person_cred_hist_length": 4
}
```

**Response**

```json
{
  "default_probability": 0.027,
  "default_prediction": 0,
  "threshold": 0.756,
  "result": "Low Risk"
}
```

## Render: deployment

- Runs as a Render web service with `uvicorn main:app`
- Redeploys automatically on every push to `main`
- Python 3.11.9 and pinned library versions, so the saved model loads exactly as it was trained

## Why we chose precision over recall

Rejecting a good customer costs a lender business and trust. With a threshold of 0.76, the model only says "High Risk" when it is confident, so almost no good applicants are turned away. The cost is that about 28% of defaulters are missed. A lender that would rather catch more defaults can lower the threshold and accept more false alarms.

## Next steps

- Choose the threshold on a separate validation set instead of the test set
- Show SHAP reasons for each prediction inside the web app
- Add automated tests and a CI check before each deploy

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000

## Project structure

| File | Description |
|---|---|
| `Credit_Risk.ipynb` | Cleaning, modeling, tuning, MLflow, SHAP |
| `main.py` | FastAPI app |
| `static/` | Web interface |
| `assets/demo.mov` | Demo video |
| `credit_risk_model.pkl` | Calibrated XGBoost pipeline |
| `best_threshold.pkl` | Decision threshold (0.76) |
| `credit_risk_dataset.csv` | Dataset |
| `mlflow.db` | MLflow run history |
| `render.yaml` | Render configuration |

## Tech stack

Python · pandas · scikit-learn · XGBoost · SHAP · MLflow · FastAPI · Pydantic · Uvicorn · Render
