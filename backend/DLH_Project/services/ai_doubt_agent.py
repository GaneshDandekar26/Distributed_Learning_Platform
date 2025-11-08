"""
AI Doubt Agent Service
Uses Gemini API to answer student questions with voice support
"""
from flask import Blueprint, request, jsonify
import google.generativeai as genai
import logging
import os
from datetime import datetime

ai_doubt_bp = Blueprint('ai_doubt', __name__)
logger = logging.getLogger(__name__)

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', 'AIzaSyDi8vq0Om5E7oJ6njzM8e2RN7cYk5g4cpU')
genai.configure(api_key=GEMINI_API_KEY)

# System prompt for the AI Doubt Agent
SYSTEM_PROMPT = """You are the AI Doubt Agent. Explain concepts simply, step-by-step, friendly, and helpful for CS subjects like DSA, OS, DBMS, CN, Maths, Coding.

Guidelines:
- Give clear, step-by-step explanations
- Use simple language that students can understand
- Provide examples when helpful
- Be encouraging and supportive
- Focus on CS fundamentals: Data Structures, Algorithms, Operating Systems, DBMS, Computer Networks, Mathematics, and Coding
- Keep answers concise but complete
- If you don't know something, say so honestly"""

# Initialize the model - use the correct approach for v0.3.2
MODEL_NAME = 'models/gemini-2.0-flash'  # Using gemini-2.0-flash from available models
model = None

try:
    # For google-generativeai==0.3.2, use full model path
    model = genai.GenerativeModel(MODEL_NAME)
    logger.info(f"Gemini AI model '{MODEL_NAME}' initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Gemini model: {e}")
    model = None

# Store conversation history (in production, use database)
conversation_history = {}


@ai_doubt_bp.route('/api/doubt/ask', methods=['POST'])
def ask_doubt():
    """
    Handle student doubt questions
    
    Body:
        - question: Student's question
        - user_id: Student's user ID (optional)
        - conversation_id: Conversation ID for history (optional)
    
    Returns:
        - answer: AI-generated answer
        - conversation_id: ID for continuing the conversation
        - timestamp: Response timestamp
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        question = data.get('question', '').strip()
        user_id = data.get('user_id', 'anonymous')
        conversation_id = data.get('conversation_id')
        
        if not question:
            return jsonify({
                'success': False,
                'error': 'Question is required'
            }), 400
        
        if not model:
            return jsonify({
                'success': False,
                'error': 'AI service is not available. Please try again later.'
            }), 503
        
        # Generate conversation ID if not provided
        if not conversation_id:
            conversation_id = f"{user_id}_{datetime.now().timestamp()}"
        
        # Get or create conversation history
        if conversation_id not in conversation_history:
            conversation_history[conversation_id] = []
        
        # Build context with history
        context = SYSTEM_PROMPT + "\n\n"
        if conversation_history[conversation_id]:
            context += "Previous conversation:\n"
            for entry in conversation_history[conversation_id][-5:]:  # Last 5 exchanges
                context += f"Student: {entry['question']}\n"
                context += f"AI: {entry['answer']}\n\n"
        
        context += f"Student's current question: {question}\n\nProvide a clear, helpful answer:"
        
        # Generate response from Gemini
        logger.info(f"Processing question from user {user_id}: {question[:50]}...")
        
        try:
            response = model.generate_content(context)
            answer = response.text.strip()
        except Exception as gen_error:
            logger.error(f"Generation error: {gen_error}")
            raise Exception(f"Failed to generate response: {gen_error}")
        
        # Store in conversation history
        conversation_history[conversation_id].append({
            'question': question,
            'answer': answer,
            'timestamp': datetime.now().isoformat()
        })
        
        # Limit history size (keep last 50 exchanges)
        if len(conversation_history[conversation_id]) > 50:
            conversation_history[conversation_id] = conversation_history[conversation_id][-50:]
        
        logger.info(f"Successfully generated answer for user {user_id}")
        
        return jsonify({
            'success': True,
            'answer': answer,
            'conversation_id': conversation_id,
            'timestamp': datetime.now().isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Error processing doubt question: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'error': f'Failed to process question: {str(e)}'
        }), 500


@ai_doubt_bp.route('/api/doubt/history/<conversation_id>', methods=['GET'])
def get_conversation_history(conversation_id):
    """
    Get conversation history for a specific conversation
    """
    try:
        history = conversation_history.get(conversation_id, [])
        
        return jsonify({
            'success': True,
            'history': history,
            'count': len(history)
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrieving conversation history: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ai_doubt_bp.route('/api/doubt/clear/<conversation_id>', methods=['DELETE'])
def clear_conversation(conversation_id):
    """
    Clear conversation history
    """
    try:
        if conversation_id in conversation_history:
            del conversation_history[conversation_id]
        
        return jsonify({
            'success': True,
            'message': 'Conversation history cleared'
        }), 200
        
    except Exception as e:
        logger.error(f"Error clearing conversation: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@ai_doubt_bp.route('/api/doubt/health', methods=['GET'])
def health_check():
    """
    Check if AI Doubt Agent service is healthy
    """
    return jsonify({
        'success': True,
        'service': 'AI Doubt Agent',
        'status': 'operational' if model else 'degraded',
        'model': MODEL_NAME,
        'active_conversations': len(conversation_history)
    }), 200
