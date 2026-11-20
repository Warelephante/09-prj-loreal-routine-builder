# Project 9: L'Oréal Routine Builder
L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder. 

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Cloudflare Worker

The frontend sends selected product data and conversation history to the class Cloudflare Worker:

`https://wunda-bot.filippramsey.workers.dev/`

The Worker handles the OpenAI request. Do not add an OpenAI API key to this repository.