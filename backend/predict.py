"""
Prediction script for using the trained ML model
"""

import joblib
import os
import numpy as np


class RequirementPredictor:
    """Load and use trained models for predictions"""
    
    def __init__(self, models_dir='models'):
        self.models_dir = models_dir
        self.model = None
        self.vectorizer = None
        self.label_encoder = None
        self.load_models()
    
    def load_models(self):
        """Load the latest trained models"""
        try:
            model_path = os.path.join(self.models_dir, 'category_classifier_latest.joblib')
            vectorizer_path = os.path.join(self.models_dir, 'vectorizer_latest.joblib')
            encoder_path = os.path.join(self.models_dir, 'label_encoder_latest.joblib')
            
            self.model = joblib.load(model_path)
            self.vectorizer = joblib.load(vectorizer_path)
            self.label_encoder = joblib.load(encoder_path)
            
            print("Models loaded successfully!")
            return True
        except FileNotFoundError as e:
            print(f"Error loading models: {e}")
            print("Please train the model first by running train_model.py")
            return False
    
    def predict(self, requirement_text):
        """Predict category for a requirement"""
        if self.model is None:
            raise ValueError("Models not loaded")
        
        # Vectorize
        text_vectorized = self.vectorizer.transform([requirement_text])
        
        # Predict
        prediction = self.model.predict(text_vectorized)
        prediction_proba = self.model.predict_proba(text_vectorized)
        
        # Decode
        category = self.label_encoder.inverse_transform(prediction)[0]
        confidence = np.max(prediction_proba)
        
        return {
            'category': category,
            'confidence': confidence,
            'probabilities': dict(zip(
                self.label_encoder.classes_,
                prediction_proba[0]
            ))
        }
    
    def predict_batch(self, requirements_list):
        """Predict categories for multiple requirements"""
        if self.model is None:
            raise ValueError("Models not loaded")
        
        # Vectorize all
        texts_vectorized = self.vectorizer.transform(requirements_list)
        
        # Predict
        predictions = self.model.predict(texts_vectorized)
        predictions_proba = self.model.predict_proba(texts_vectorized)
        
        # Decode
        categories = self.label_encoder.inverse_transform(predictions)
        confidences = np.max(predictions_proba, axis=1)
        
        results = []
        for i, text in enumerate(requirements_list):
            results.append({
                'requirement': text[:100] + '...' if len(text) > 100 else text,
                'category': categories[i],
                'confidence': confidences[i],
                'probabilities': dict(zip(
                    self.label_encoder.classes_,
                    predictions_proba[i]
                ))
            })
        
        return results


def main():
    """Demo the predictor"""
    predictor = RequirementPredictor()
    
    # Test samples
    test_requirements = [
        "The system shall calculate routes using current road network data.",
        "The interface shall be easy to use with minimal user interactions.",
        "The system shall respond within 3 seconds to user requests.",
        "The system shall be available 99.5% of the time.",
        "User data shall be encrypted and protected from unauthorized access."
    ]
    
    print("\n" + "="*60)
    print("Batch Prediction Demo")
    print("="*60)
    
    results = predictor.predict_batch(test_requirements)
    
    for i, result in enumerate(results, 1):
        print(f"\n{i}. Requirement: {result['requirement']}")
        print(f"   Predicted Category: {result['category']}")
        print(f"   Confidence: {result['confidence']:.2%}")


if __name__ == "__main__":
    main()
