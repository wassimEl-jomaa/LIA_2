"""
Machine Learning Model for Requirements and Test Cases Analysis
Trains models to classify requirements and predict test case relationships
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import joblib
import os
from datetime import datetime


class RequirementsMLModel:
    """Machine Learning model for requirements and test cases analysis"""
    
    def __init__(self, data_path='data/requirements.csv'):
        self.data_path = data_path
        self.df = None
        self.vectorizer = None
        self.category_model = None
        self.label_encoder = None
        self.models_dir = 'models'
        
        # Create models directory if it doesn't exist
        if not os.path.exists(self.models_dir):
            os.makedirs(self.models_dir)
    
    def load_data(self):
        """Load and preprocess the requirements data"""
        print("Loading data from:", self.data_path)
        self.df = pd.read_csv(self.data_path)
        print(f"Loaded {len(self.df)} records")
        print(f"Columns: {list(self.df.columns)}")
        print(f"\nData shape: {self.df.shape}")
        print(f"\nRequirement categories: {self.df['req_category'].unique()}")
        print(f"Category distribution:\n{self.df['req_category'].value_counts()}")
        return self.df
    
    def preprocess_data(self):
        """Preprocess text data for ML"""
        print("\nPreprocessing data...")
        
        # Combine relevant text fields for feature extraction
        self.df['combined_text'] = (
            self.df['requirement_text'].fillna('') + ' ' +
            self.df['test_case_title'].fillna('') + ' ' +
            self.df['preconditions'].fillna('') + ' ' +
            self.df['test_steps'].fillna('') + ' ' +
            self.df['expected_results'].fillna('')
        )
        
        # Remove duplicates if any
        initial_count = len(self.df)
        self.df = self.df.drop_duplicates(subset=['test_case_id'])
        print(f"Removed {initial_count - len(self.df)} duplicate test cases")
        
        return self.df
    
    def train_category_classifier(self):
        """Train a model to classify requirement categories"""
        print("\n" + "="*60)
        print("Training Requirement Category Classifier")
        print("="*60)
        
        # Prepare features and labels
        X = self.df['combined_text']
        y = self.df['req_category']
        
        # Encode labels
        self.label_encoder = LabelEncoder()
        y_encoded = self.label_encoder.fit_transform(y)
        
        print(f"\nClasses: {self.label_encoder.classes_}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )
        
        print(f"Training set size: {len(X_train)}")
        print(f"Test set size: {len(X_test)}")
        
        # Vectorize text
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 3),
            min_df=2,
            max_df=0.95,
            stop_words='english'
        )
        
        X_train_vectorized = self.vectorizer.fit_transform(X_train)
        X_test_vectorized = self.vectorizer.transform(X_test)
        
        print(f"\nFeature matrix shape: {X_train_vectorized.shape}")
        
        # Train multiple models and compare
        models = {
            'Random Forest': RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10),
            'Gradient Boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'Naive Bayes': MultinomialNB()
        }
        
        best_model = None
        best_score = 0
        best_name = ""
        
        for name, model in models.items():
            print(f"\n--- Training {name} ---")
            model.fit(X_train_vectorized, y_train)
            
            # Predictions
            y_pred = model.predict(X_test_vectorized)
            
            # Evaluation
            accuracy = accuracy_score(y_test, y_pred)
            print(f"Accuracy: {accuracy:.4f}")
            
            print("\nClassification Report:")
            print(classification_report(
                y_test, y_pred,
                target_names=self.label_encoder.classes_,
                zero_division=0
            ))
            
            if accuracy > best_score:
                best_score = accuracy
                best_model = model
                best_name = name
        
        print(f"\n{'='*60}")
        print(f"Best Model: {best_name} with accuracy: {best_score:.4f}")
        print(f"{'='*60}")
        
        self.category_model = best_model
        
        return best_model, self.vectorizer
    
    def train_requirement_analyzer(self):
        """Train additional analysis models"""
        print("\n" + "="*60)
        print("Training Requirement Complexity Analyzer")
        print("="*60)
        
        # Create complexity score based on text length and structure
        self.df['complexity_score'] = (
            self.df['requirement_text'].str.len() +
            self.df['test_steps'].str.len() +
            self.df['expected_results'].str.len()
        ) / 3
        
        # Categorize into complexity levels
        self.df['complexity_level'] = pd.cut(
            self.df['complexity_score'],
            bins=[0, 100, 200, float('inf')],
            labels=['Low', 'Medium', 'High']
        )
        
        print(f"\nComplexity Distribution:")
        print(self.df['complexity_level'].value_counts())
        
        return self.df
    
    def save_models(self):
        """Save trained models and preprocessors"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        print("\nSaving models...")
        
        # Save category classifier
        model_path = os.path.join(self.models_dir, f'category_classifier_{timestamp}.joblib')
        joblib.dump(self.category_model, model_path)
        print(f"Saved category classifier to: {model_path}")
        
        # Save vectorizer
        vectorizer_path = os.path.join(self.models_dir, f'vectorizer_{timestamp}.joblib')
        joblib.dump(self.vectorizer, vectorizer_path)
        print(f"Saved vectorizer to: {vectorizer_path}")
        
        # Save label encoder
        encoder_path = os.path.join(self.models_dir, f'label_encoder_{timestamp}.joblib')
        joblib.dump(self.label_encoder, encoder_path)
        print(f"Saved label encoder to: {encoder_path}")
        
        # Save latest versions (without timestamp)
        joblib.dump(self.category_model, os.path.join(self.models_dir, 'category_classifier_latest.joblib'))
        joblib.dump(self.vectorizer, os.path.join(self.models_dir, 'vectorizer_latest.joblib'))
        joblib.dump(self.label_encoder, os.path.join(self.models_dir, 'label_encoder_latest.joblib'))
        print("\nSaved latest versions")
        
        return True
    
    def predict_category(self, requirement_text):
        """Predict category for a new requirement"""
        if self.category_model is None or self.vectorizer is None:
            raise ValueError("Model not trained. Please train the model first.")
        
        # Vectorize input
        text_vectorized = self.vectorizer.transform([requirement_text])
        
        # Predict
        prediction = self.category_model.predict(text_vectorized)
        prediction_proba = self.category_model.predict_proba(text_vectorized)
        
        # Decode label
        category = self.label_encoder.inverse_transform(prediction)[0]
        confidence = np.max(prediction_proba)
        
        return {
            'category': category,
            'confidence': confidence,
            'all_probabilities': dict(zip(
                self.label_encoder.classes_,
                prediction_proba[0]
            ))
        }
    
    def generate_feature_importance(self):
        """Analyze feature importance"""
        if isinstance(self.category_model, RandomForestClassifier):
            print("\n" + "="*60)
            print("Feature Importance Analysis")
            print("="*60)
            
            # Get feature names
            feature_names = self.vectorizer.get_feature_names_out()
            
            # Get importance scores
            importances = self.category_model.feature_importances_
            
            # Sort by importance
            indices = np.argsort(importances)[::-1][:20]  # Top 20 features
            
            print("\nTop 20 Most Important Features:")
            for i, idx in enumerate(indices, 1):
                print(f"{i}. {feature_names[idx]}: {importances[idx]:.4f}")
    
    def train_all(self):
        """Complete training pipeline"""
        print("="*60)
        print("Requirements ML Model Training Pipeline")
        print("="*60)
        
        # Load data
        self.load_data()
        
        # Preprocess
        self.preprocess_data()
        
        # Train category classifier
        self.train_category_classifier()
        
        # Train complexity analyzer
        self.train_requirement_analyzer()
        
        # Feature importance
        self.generate_feature_importance()
        
        # Save models
        self.save_models()
        
        print("\n" + "="*60)
        print("Training Complete!")
        print("="*60)


def main():
    """Main training function"""
    # Initialize model
    model = RequirementsMLModel(data_path='data/requirements.csv')
    
    # Train all models
    model.train_all()
    
    # Test prediction with sample
    print("\n" + "="*60)
    print("Testing Prediction")
    print("="*60)
    
    sample_requirement = """
    The navigation system shall calculate a route from a user-specified 
    origin to a user-specified destination using the current road network data.
    """
    
    result = model.predict_category(sample_requirement)
    print(f"\nSample Requirement:")
    print(sample_requirement)
    print(f"\nPredicted Category: {result['category']}")
    print(f"Confidence: {result['confidence']:.2%}")
    print(f"\nAll Probabilities:")
    for category, prob in result['all_probabilities'].items():
        print(f"  {category}: {prob:.2%}")


if __name__ == "__main__":
    main()
